import * as constants from '../../shared/constants'

const canInjectTab = (tab) => {
    if (!tab?.id || tab.id < 0) return false
    const url = tab.url || ''
    return /^(https?:|file:|ftp:)/.test(url)
}

const handleSendResponse = (callback) => (response) => {
    if (chrome.runtime.lastError) {
        return
    }
    if (callback) callback(response)
}

// Sends a message to content
export const sendMessageToContent = (subject, payload, callback) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0]
        if (!canInjectTab(tab)) {
            if (callback) callback(undefined)
            return
        }
        chrome.tabs.sendMessage(
            tab.id,
            { from: constants.commAgents.BACKGROUND, subject, payload },
            handleSendResponse(callback)
        )
    })
}

// Sends a message to background
export const sendMessageToBackground = (subject, payload, callback) => {
    chrome.runtime.sendMessage(
        { from: constants.commAgents.BACKGROUND, subject, payload },
        (response) => {
            if (chrome.runtime.lastError) {
                console.warn('background self-message:', chrome.runtime.lastError.message)
                return
            }
            if (callback) callback(response)
        }
    )
}
