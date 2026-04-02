import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { CallStatusBanner } from '../CallStatusBanner'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { callSlice } from '../../store/callSlice'
import { callWorkflowSlice } from '../../store/callWorkflowSlice'
import { useGetCallStatusQuery, useEndCallMutation } from '../../services/api/callWorkflowApi'

// Mock the API hooks
jest.mock('../../services/api/callWorkflowApi', () => ({
  useGetCallStatusQuery: jest.fn(),
  useEndCallMutation: jest.fn(),
}))

const mockEndCall = jest.fn()

// Mock the date utilities
jest.mock('../../utils/dateUtils', () => ({
  formatDuration: jest.fn((seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`),
}))

// Create a test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      call: callSlice.reducer,
      callWorkflow: callWorkflowSlice.reducer,
    },
  })
}

const renderWithProvider = (component: React.ReactElement) => {
  const store = createTestStore()
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  )
}

describe('CallStatusBanner', () => {
  const defaultProps = {
    conversationId: 'conv-123',
    initialStatus: 'initiating',
    clientName: 'John Doe',
    onStatusChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    ;(useGetCallStatusQuery as jest.Mock).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isFetching: false,
    })
    ;(useEndCallMutation as jest.Mock).mockReturnValue([mockEndCall, { isLoading: false }])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders correctly with initial status', () => {
    const { getByTestId, getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="initiated" />
    )

    expect(getByTestId('call-status-banner')).toBeTruthy()
    expect(getByTestId('call-status-badge')).toBeTruthy()
    expect(getByText('INITIATED')).toBeTruthy()
    expect(getByText('Setting up call...')).toBeTruthy()
  })

  it('shows correct status message for different call statuses', () => {
    const statusTests = [
      { status: 'initiated', message: 'Setting up call...' },
      { status: 'in-progress', message: 'Connected with John Doe' },
      { status: 'completed', message: 'Call ended' },
      { status: 'failed', message: 'Call failed' },
    ]

    statusTests.forEach(({ status, message }) => {
      const { getByText } = renderWithProvider(
        <CallStatusBanner {...defaultProps} initialStatus={status} />
      )
      expect(getByText(message)).toBeTruthy()
    })
  })

  it('updates status when API data changes', async () => {
    const mockStatusResponse = {
      data: {
        conversationId: 'conv-123',
        status: 'in-progress'
      }
    }

    ;(useGetCallStatusQuery as jest.Mock).mockReturnValue({
      data: mockStatusResponse,
      error: undefined,
      isLoading: false,
      isFetching: false,
    })

    const { getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="initiated" />
    )

    await waitFor(() => {
      expect(getByText('Connected with John Doe')).toBeTruthy()
    })
  })

  it('shows End Call button when call is in progress', () => {
    const { getByTestId, queryByTestId } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="in-progress" />
    )

    // Should show End Call button for connected calls
    expect(getByTestId('end-call-button')).toBeTruthy()
    expect(getByTestId('end-call-button')).toHaveTextContent('End Call')
  })

  it('does not show End Call button for non-active statuses', () => {
    const { queryByTestId } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="initiated" />
    )

    // Should not show End Call button for non-connected calls
    expect(queryByTestId('end-call-button')).toBeNull()
  })

  it('handles end call action', async () => {
    mockEndCall.mockReturnValue({
      unwrap: () => Promise.resolve({ success: true }),
    })

    const { getByTestId } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="in-progress" />
    )

    const endCallButton = getByTestId('end-call-button')
    fireEvent.press(endCallButton)

    await waitFor(() => {
      expect(mockEndCall).toHaveBeenCalledWith({
        conversationId: 'conv-123',
        data: {
          outcome: 'answered',
          notes: 'Call ended by agent'
        }
      })
    })
  })

  it('shows error message when end call fails', async () => {
    mockEndCall.mockReturnValue({
      unwrap: () => Promise.reject(new Error('Failed to end call')),
    })

    const loggerErrorSpy = jest.spyOn(require('../../utils/logger').logger, 'error').mockImplementation(() => {})
    const loggerInfoSpy = jest.spyOn(require('../../utils/logger').logger, 'info').mockImplementation(() => {})

    const { getByTestId, getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="in-progress" />
    )

    const endCallButton = getByTestId('end-call-button')
    await act(async () => {
      fireEvent.press(endCallButton)
    })
    await waitFor(() => {
      expect(getByText('Failed to end call')).toBeTruthy()
    })

    loggerErrorSpy.mockRestore()
    loggerInfoSpy.mockRestore()
  })

  it('updates call duration for active calls', () => {
    const mockStatusResponse = {
      data: {
        conversationId: 'conv-123',
        status: 'in-progress',
        startTime: new Date().toISOString(),
      }
    }

    ;(useGetCallStatusQuery as jest.Mock).mockReturnValue({
      data: mockStatusResponse,
      error: undefined,
      isLoading: false,
      isFetching: false,
    })

    const { getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="in-progress" />
    )

    // Fast-forward time to simulate call duration
    act(() => {
      jest.advanceTimersByTime(5000) // 5 seconds
    })

    // Should show duration (format depends on mock implementation)
    expect(getByText(/Duration:/)).toBeTruthy()
  })

  it('calls onStatusChange when status updates', async () => {
    const mockStatusResponse = {
      data: {
        conversationId: 'conv-123',
        status: 'completed'
      }
    }

    ;(useGetCallStatusQuery as jest.Mock).mockReturnValue({
      data: mockStatusResponse,
      error: undefined,
      isLoading: false,
      isFetching: false,
    })

    renderWithProvider(<CallStatusBanner {...defaultProps} initialStatus="initiated" />)

    await waitFor(() => {
      expect(defaultProps.onStatusChange).toHaveBeenCalledWith('completed')
    })
  })

  it('handles API errors gracefully', () => {
    ;(useGetCallStatusQuery as jest.Mock).mockReturnValue({
      data: undefined,
      error: new Error('API Error'),
      isLoading: false,
      isFetching: false,
    })

    renderWithProvider(<CallStatusBanner {...defaultProps} initialStatus="initiated" />)
  })
})
