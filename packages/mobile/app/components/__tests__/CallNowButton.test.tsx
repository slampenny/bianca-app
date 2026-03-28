import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { CallNowButton } from '../CallNowButton'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { conversationSlice } from '../../store/conversationSlice'
import { callSlice } from '../../store/callSlice'
import { callWorkflowSlice } from '../../store/callWorkflowSlice'

// Mock the navigation
const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}))

const mockInitiateCallMutation = jest.fn()

// Mock the API hook and provide minimal API shape so store.ts does not warn "Missing API service: callWorkflowApi"
jest.mock('../../services/api/callWorkflowApi', () => ({
  useInitiateCallMutation: () => [mockInitiateCallMutation],
  callWorkflowApi: {
    reducerPath: 'callWorkflowApi',
    reducer: (state = {}) => state,
    middleware: () => (next: (a: unknown) => unknown) => (action: unknown) => next(action),
  },
}))

// Create a test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      conversation: conversationSlice.reducer,
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

describe('CallNowButton', () => {
  const defaultProps = {
    clientId: 'client-123',
    clientName: 'John Doe',
    disabled: false,
  }
  const mockSuccessResponse = {
    data: {
      conversationId: 'conv-123',
      status: 'initiated',
      callSid: 'call-456',
      clientId: 'client-123',
      clientName: 'John Doe',
      clientPhone: '+1234567890',
      caregiverId: 'caregiver-123',
      caregiverName: 'Caregiver Name',
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockInitiateCallMutation.mockReset()
  })

  it('renders correctly with default props', () => {
    const { getByTestId, getByText } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    expect(getByTestId('call-now-John Doe')).toBeTruthy()
    expect(getByText('Call Now')).toBeTruthy()
  })

  it('shows client name in call notes when initiating call', async () => {
    const mockResponse = {
      data: {
        conversationId: 'conv-123',
        callSid: 'call-456',
        clientId: 'client-123',
        clientName: 'John Doe',
        clientPhone: '+1234567890',
        caregiverId: 'caregiver-123',
        caregiverName: 'Caregiver Name',
        callStatus: 'ringing'
      }
    }

    mockInitiateCallMutation.mockReturnValue({
      unwrap: () => Promise.resolve(mockResponse.data),
    })

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-John Doe')
    fireEvent.press(button)

    await waitFor(() => {
      expect(mockInitiateCallMutation).toHaveBeenCalledWith({
        clientId: 'client-123',
        callNotes: 'Manual call initiated by agent to John Doe'
      })
    })
  })

  it('navigates to call screen after successful call initiation', async () => {
    const mockResponse = {
      data: {
        conversationId: 'conv-123',
        callSid: 'call-456',
        clientId: 'client-123',
        clientName: 'John Doe',
        clientPhone: '+1234567890',
        caregiverId: 'caregiver-123',
        caregiverName: 'Caregiver Name',
        callStatus: 'ringing'
      }
    }

    mockInitiateCallMutation.mockReturnValue({
      unwrap: () => Promise.resolve(mockResponse.data),
    })

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-John Doe')
    fireEvent.press(button)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Call')
    })
  })

  it('shows loading state while calling', async () => {
    let resolvePromise: (value: typeof mockSuccessResponse.data) => void
    const pendingPromise = new Promise<typeof mockSuccessResponse.data>((resolve) => {
      resolvePromise = resolve
    })
    mockInitiateCallMutation.mockReturnValue({
      unwrap: () => pendingPromise,
    })

    const { getByTestId, getByText } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-John Doe')
    await act(async () => {
      fireEvent.press(button)
    })

    // Should show "Calling..." text
    expect(getByText('Calling...')).toBeTruthy()

    await act(async () => {
      resolvePromise!(mockSuccessResponse.data)
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(mockInitiateCallMutation).toHaveBeenCalledTimes(1)
    })
  })

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to initiate call'
    mockInitiateCallMutation.mockReturnValue({
      unwrap: () => Promise.reject({ data: { message: errorMessage } })
    })

    const loggerSpy = jest.spyOn(require('../../utils/logger').logger, 'error').mockImplementation(() => {})

    const { getByTestId, getByText } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-John Doe')
    await act(async () => {
      fireEvent.press(button)
    })
    await waitFor(() => {
      expect(getByText(errorMessage)).toBeTruthy()
    })

    loggerSpy.mockRestore()
  })

  it('is disabled when disabled prop is true', () => {
    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} disabled={true} />
    )

    const button = getByTestId('call-now-John Doe')
    expect(button.props.accessibilityState?.disabled).toBe(true)
  })

  it('is disabled while call is in progress', async () => {
    let resolvePromise: (value: typeof mockSuccessResponse.data) => void
    const pendingPromise = new Promise<typeof mockSuccessResponse.data>((resolve) => {
      resolvePromise = resolve
    })
    mockInitiateCallMutation.mockReturnValue({
      unwrap: () => pendingPromise,
    })

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-John Doe')
    await act(async () => {
      fireEvent.press(button)
    })

    // Button should be disabled while calling
    expect(button.props.accessibilityState?.disabled).toBe(true)

    await act(async () => {
      resolvePromise!(mockSuccessResponse.data)
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(mockInitiateCallMutation).toHaveBeenCalledTimes(1)
    })
  })

  it('prevents multiple simultaneous calls', async () => {
    let resolvePromise: (value: typeof mockSuccessResponse.data) => void
    const pendingPromise = new Promise<typeof mockSuccessResponse.data>((resolve) => {
      resolvePromise = resolve
    })
    mockInitiateCallMutation.mockReturnValue({
      unwrap: () => pendingPromise,
    })

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-John Doe')

    await act(async () => {
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(button)
    })

    // Should only call the API once
    await waitFor(() => {
      expect(mockInitiateCallMutation).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      resolvePromise!(mockSuccessResponse.data)
      await Promise.resolve()
    })
  })
})
