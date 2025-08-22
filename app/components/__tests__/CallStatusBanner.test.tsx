import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { CallStatusBanner } from '../CallStatusBanner'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { conversationSlice } from '../../store/conversationSlice'
import { callWorkflowSlice } from '../../store/callWorkflowSlice'

// Mock the API calls
jest.mock('../../services/api/callWorkflowApi', () => ({
  getCallStatus: jest.fn(),
  endCall: jest.fn(),
}))

const { getCallStatus, endCall } = require('../../services/api/callWorkflowApi')

// Mock the date utilities
jest.mock('../../utils/dateUtils', () => ({
  formatDuration: jest.fn((seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`),
}))

// Create a test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      conversation: conversationSlice.reducer,
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
    patientName: 'John Doe',
    onStatusChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders correctly with initial status', () => {
    const { getByTestId, getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} />
    )

    expect(getByTestId('call-status-banner')).toBeTruthy()
    expect(getByTestId('call-status-badge')).toBeTruthy()
    expect(getByText('INITIATING')).toBeTruthy()
    expect(getByText('Initiating call...')).toBeTruthy()
  })

  it('shows correct status message for different call statuses', () => {
    const { getByText, rerender } = renderWithProvider(
      <CallStatusBanner {...defaultProps} />
    )

    // Test different statuses
    const statusTests = [
      { status: 'ringing', message: 'Calling John Doe...' },
      { status: 'answered', message: 'John Doe answered' },
      { status: 'connected', message: 'Connected with John Doe' },
      { status: 'ended', message: 'Call ended' },
      { status: 'failed', message: 'Call failed' },
      { status: 'busy', message: 'Line busy' },
      { status: 'no_answer', message: 'No answer' },
    ]

    statusTests.forEach(({ status, message }) => {
      rerender(
        <Provider store={createTestStore()}>
          <CallStatusBanner {...defaultProps} initialStatus={status} />
        </Provider>
      )
      expect(getByText(message)).toBeTruthy()
    })
  })

  it('polls for call status updates', async () => {
    const mockStatusResponse = {
      data: {
        conversationId: 'conv-123',
        callStatus: 'connected',
        callStartTime: new Date().toISOString(),
        callDuration: 120,
        callOutcome: null,
        callNotes: 'Test call',
        patient: { _id: 'patient-123', name: 'John Doe', phone: '+1234567890' },
        agent: { _id: 'agent-123', name: 'Agent Name' },
        status: 'in-progress'
      }
    }

    ;(getCallStatus as jest.Mock).mockResolvedValue(mockStatusResponse)

    renderWithProvider(<CallStatusBanner {...defaultProps} />)

    // Fast-forward time to trigger polling
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(getCallStatus).toHaveBeenCalledWith('conv-123')
    })
  })

  it('shows End Call button when call is connected', () => {
    const { getByTestId, queryByTestId } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="connected" />
    )

    // Should show End Call button for connected calls
    expect(getByTestId('end-call-button')).toBeTruthy()
    expect(getByTestId('end-call-button')).toHaveTextContent('End Call')
  })

  it('does not show End Call button for non-connected statuses', () => {
    const { queryByTestId } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="ringing" />
    )

    // Should not show End Call button for non-connected calls
    expect(queryByTestId('end-call-button')).toBeNull()
  })

  it('handles end call action', async () => {
    ;(endCall as jest.Mock).mockResolvedValue({ data: { success: true } })

    const { getByTestId } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="connected" />
    )

    const endCallButton = getByTestId('end-call-button')
    fireEvent.press(endCallButton)

    await waitFor(() => {
      expect(endCall).toHaveBeenCalledWith('conv-123', 'answered', 'Call ended by agent')
    })
  })

  it('shows error message when end call fails', async () => {
    ;(endCall as jest.Mock).mockRejectedValue(new Error('Failed to end call'))

    const { getByTestId, getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="connected" />
    )

    const endCallButton = getByTestId('end-call-button')
    fireEvent.press(endCallButton)

    await waitFor(() => {
      expect(getByText('Failed to end call')).toBeTruthy()
    })
  })

  it('updates call duration for active calls', () => {
    const { getByText } = renderWithProvider(
      <CallStatusBanner {...defaultProps} initialStatus="connected" />
    )

    // Fast-forward time to simulate call duration
    act(() => {
      jest.advanceTimersByTime(5000) // 5 seconds
    })

    // Should show duration (format depends on mock implementation)
    expect(getByText(/Duration:/)).toBeTruthy()
  })

  it('stops polling when call is ended', async () => {
    const mockStatusResponse = {
      data: {
        conversationId: 'conv-123',
        callStatus: 'ended',
        callStartTime: new Date().toISOString(),
        callEndTime: new Date().toISOString(),
        callDuration: 300,
        callOutcome: 'answered',
        callNotes: 'Call completed',
        patient: { _id: 'patient-123', name: 'John Doe', phone: '+1234567890' },
        agent: { _id: 'agent-123', name: 'Agent Name' },
        status: 'completed'
      }
    }

    ;(getCallStatus as jest.Mock).mockResolvedValue(mockStatusResponse)

    renderWithProvider(<CallStatusBanner {...defaultProps} />)

    // First call should happen
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(getCallStatus).toHaveBeenCalledTimes(1)
    })

    // Further calls should not happen since status is 'ended'
    act(() => {
      jest.advanceTimersByTime(4000)
    })

    // Should still only be called once
    expect(getCallStatus).toHaveBeenCalledTimes(1)
  })

  it('calls onStatusChange when status updates', async () => {
    const mockStatusResponse = {
      data: {
        conversationId: 'conv-123',
        callStatus: 'connected',
        callStartTime: new Date().toISOString(),
        callDuration: 120,
        callOutcome: null,
        callNotes: 'Test call',
        patient: { _id: 'patient-123', name: 'John Doe', phone: '+1234567890' },
        agent: { _id: 'agent-123', name: 'Agent Name' },
        status: 'in-progress'
      }
    }

    ;(getCallStatus as jest.Mock).mockResolvedValue(mockStatusResponse)

    renderWithProvider(<CallStatusBanner {...defaultProps} />)

    // Fast-forward time to trigger polling
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(defaultProps.onStatusChange).toHaveBeenCalledWith('connected')
    })
  })

  it('handles API errors gracefully during status polling', async () => {
    ;(getCallStatus as jest.Mock).mockRejectedValue(new Error('API Error'))

    renderWithProvider(<CallStatusBanner {...defaultProps} />)

    // Fast-forward time to trigger polling
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Should not crash, just log error
    await waitFor(() => {
      expect(getCallStatus).toHaveBeenCalled()
    })
  })
})
