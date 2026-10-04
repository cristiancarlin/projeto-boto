/*global chrome*/
import * as constants from './Constants'

const canInjectTab = (tab) => {
    if (!tab?.id || tab.id < 0) return false
    const url = tab.url || ''
    return /^(https?:|file:|ftp:)/.test(url)
}

const handleSendResponse = (callback) => (response) => {
    if (chrome.runtime.lastError) {
        // Expected when tab has no content script (chrome://, new tab, not yet injected)
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
            { from: constants.commAgents.POPUP, subject, payload },
            handleSendResponse(callback)
        )
    })
}

// Sends a message to all contents
export const sendMessageToAllContents = (subject, payload, callback) => {
    chrome.tabs.query({}, tabs => {
        tabs.filter(canInjectTab).forEach(tab => {
            chrome.tabs.sendMessage(
                tab.id,
                { from: constants.commAgents.POPUP, subject, payload },
                handleSendResponse(callback)
            )
        })
    })
}

// Sends a message to background
export const sendMessageToBackground = (subject, payload, callback) => {
    chrome.runtime.sendMessage(
        { from: constants.commAgents.POPUP, subject, payload },
        (response) => {
            if (chrome.runtime.lastError) {
                console.warn('popup → background:', chrome.runtime.lastError.message)
                return
            }
            if (callback) callback(response)
        }
    )
}
