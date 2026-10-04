import * as constants from '../../shared/constants'

// Sends a message to background
export const sendMessageToBackground = (subject, payload, callback) => {
    chrome.runtime.sendMessage(
        { from: constants.commAgents.CONTENT, subject, payload },
        (response) => {
            if (chrome.runtime.lastError) {
                console.warn('content → background:', chrome.runtime.lastError.message)
                return
            }
            if (callback) callback(response)
        }
    )
}
