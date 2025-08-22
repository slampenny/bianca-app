import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { CallNowButton } from '../CallNowButton'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { conversationSlice } from '../../store/conversationSlice'
import { callWorkflowSlice } from '../../store/callWorkflowSlice'

// Mock the navigation
const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}))

// Mock the API call
jest.mock('../../services/api/callWorkflowApi', () => ({
  initiateCall: jest.fn(),
}))

const { initiateCall } = require('../../services/api/callWorkflowApi')

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

describe('CallNowButton', () => {
  const defaultProps = {
    patientId: 'patient-123',
    patientName: 'John Doe',
    disabled: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly with default props', () => {
    const { getByTestId, getByText } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    expect(getByTestId('call-now-patient-123')).toBeTruthy()
    expect(getByText('Call Now')).toBeTruthy()
  })

  it('shows patient name in call notes when initiating call', async () => {
    const mockResponse = {
      data: {
        conversationId: 'conv-123',
        callSid: 'call-456',
        patientId: 'patient-123',
        patientName: 'John Doe',
        patientPhone: '+1234567890',
        agentId: 'agent-123',
        agentName: 'Agent Name',
        callStatus: 'ringing'
      }
    }

    ;(initiateCall as jest.Mock).mockResolvedValue(mockResponse)

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-patient-123')
    fireEvent.press(button)

    await waitFor(() => {
      expect(initiateCall).toHaveBeenCalledWith({
        patientId: 'patient-123',
        callNotes: 'Manual call initiated by agent to John Doe'
      })
    })
  })

  it('navigates to conversations screen after successful call initiation', async () => {
    const mockResponse = {
      data: {
        conversationId: 'conv-123',
        callSid: 'call-456',
        patientId: 'patient-123',
        patientName: 'John Doe',
        patientPhone: '+1234567890',
        agentId: 'agent-123',
        agentName: 'Agent Name',
        callStatus: 'ringing'
      }
    }

    ;(initiateCall as jest.Mock).mockResolvedValue(mockResponse)

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-patient-123')
    fireEvent.press(button)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Conversations', {
        conversationId: 'conv-123',
        isActiveCall: true,
        callStatus: 'ringing',
        patientName: 'John Doe'
      })
    })
  })

  it('shows loading state while calling', async () => {
    // Mock a delayed response
    ;(initiateCall as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    const { getByTestId, getByText } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-patient-123')
    fireEvent.press(button)

    // Should show "Calling..." text
    expect(getByText('Calling...')).toBeTruthy()
  })

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to initiate call'
    ;(initiateCall as jest.Mock).mockRejectedValue({
      response: { data: { message: errorMessage } }
    })

    const { getByTestId, getByText } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-patient-123')
    fireEvent.press(button)

    await waitFor(() => {
      expect(getByText(errorMessage)).toBeTruthy()
    })
  })

  it('is disabled when disabled prop is true', () => {
    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} disabled={true} />
    )

    const button = getByTestId('call-now-patient-123')
    expect(button.props.disabled).toBe(true)
  })

  it('is disabled while call is in progress', async () => {
    // Mock a delayed response
    ;(initiateCall as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-patient-123')
    fireEvent.press(button)

    // Button should be disabled while calling
    expect(button.props.disabled).toBe(true)
  })

  it('prevents multiple simultaneous calls', async () => {
    // Mock a delayed response
    ;(initiateCall as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    const { getByTestId } = renderWithProvider(
      <CallNowButton {...defaultProps} />
    )

    const button = getByTestId('call-now-patient-123')
    
    // Press button multiple times
    fireEvent.press(button)
    fireEvent.press(button)
    fireEvent.press(button)

    // Should only call the API once
    await waitFor(() => {
      expect(initiateCall).toHaveBeenCalledTimes(1)
    })
  })
})
