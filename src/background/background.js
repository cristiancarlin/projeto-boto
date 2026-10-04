import * as constants from '../shared/constants'
import * as userSettingsMapper from './utils/userSettingsMapper'

console.log('background: loaded')

async function setStorage(keyName, data) {
    await chrome.storage.local.set({ [keyName]: data })
}

async function getStorage(keyName) {
    const result = await chrome.storage.local.get(keyName)
    return result[keyName] ?? null
}

const extensionDisabledData = {
    settingsData: constants.disabledSettingsData,
    extensionData: constants.disabledExtensionData
}

const AD_RULE_IDS = [1, 2, 3, 4]

const adBlockRules = [
    { id: 1, urlFilter: '||doubleclick.net^' },
    { id: 2, urlFilter: '||googleadservices.com^' },
    { id: 3, urlFilter: '||googlesyndication.com^' },
    { id: 4, urlFilter: '||moat.com^' }
].map((rule) => ({
    id: rule.id,
    priority: 1,
    action: { type: 'block' },
    condition: {
        urlFilter: rule.urlFilter,
        resourceTypes: [
            'main_frame',
            'sub_frame',
            'script',
            'image',
            'xmlhttprequest',
            'media',
            'other'
        ]
    }
}))

async function enableAdBlocking() {
    console.log('background: enabling ad blocking')
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: AD_RULE_IDS,
        addRules: adBlockRules
    })
}

async function disableAdBlocking() {
    console.log('background: disabling ad blocking')
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: AD_RULE_IDS,
        addRules: []
    })
}

async function ensureDefaults() {
    const stored = await chrome.storage.local.get([
        'userData',
        'settingsData',
        'extensionData'
    ])
    if (stored.userData == null) {
        await setStorage('userData', constants.defaultUserData)
    }
    if (stored.settingsData == null) {
        await setStorage('settingsData', constants.defaultSettingsData)
    }
    if (stored.extensionData == null) {
        await setStorage('extensionData', constants.defaultExtensionData)
    }
}

chrome.runtime.onInstalled.addListener(() => {
    ensureDefaults()
})

ensureDefaults()

chrome.runtime.onMessage.addListener((msg, sender, response) => {
    console.log(msg)
    console.log(sender)

    if (msg.from !== constants.commAgents.POPUP && msg.from !== constants.commAgents.CONTENT) {
        return false
    }

    ;(async () => {
        try {
            switch (msg.subject) {
                case constants.commSubjects.UPDATE.USER_DATA: {
                    await setStorage('userData', msg.payload)
                    const storeToSettingsData = userSettingsMapper.map(
                        await getStorage('settingsData'),
                        await getStorage('userData')
                    )
                    await setStorage('settingsData', storeToSettingsData)
                    response(await getStorage('settingsData'))
                    break
                }

                case constants.commSubjects.UPDATE.SETTINGS_DATA: {
                    const extensionData = await getStorage('extensionData')
                    if (extensionData?.extensionEnabled) {
                        await setStorage('settingsData', msg.payload)
                    }
                    if (msg.payload.options.noise.includes(constants.noiseTypes.ADS)) {
                        await enableAdBlocking()
                    } else {
                        await disableAdBlocking()
                    }
                    response('settingsData updated')
                    break
                }

                case constants.commSubjects.UPDATE.EXTENSION_DATA: {
                    const extensionData = await getStorage('extensionData')
                    if (extensionData?.extensionEnabled) {
                        await setStorage('extensionData', msg.payload)
                    } else if (msg.payload.extensionEnabled) {
                        const extensionDataFromStorage = await getStorage('extensionData')
                        extensionDataFromStorage.extensionEnabled = true
                        await setStorage('extensionData', extensionDataFromStorage)
                        await chrome.action.setIcon({
                            path: '/assets/boto_32.png'
                        })
                    }
                    if (!msg.payload.extensionEnabled) {
                        await chrome.action.setIcon({
                            path: '/assets/boto_off.png'
                        })
                    }
                    response('extensionData updated')
                    break
                }

                case constants.commSubjects.REQUEST.SETTINGS_DATA: {
                    const extensionData = await getStorage('extensionData')
                    if (extensionData?.extensionEnabled) {
                        response(await getStorage('settingsData'))
                    } else {
                        response(extensionDisabledData.settingsData)
                    }
                    break
                }

                case constants.commSubjects.REQUEST.EXTENSION_DATA: {
                    const extensionData = await getStorage('extensionData')
                    if (extensionData?.extensionEnabled) {
                        response(extensionData)
                    } else {
                        response(extensionDisabledData.extensionData)
                    }
                    break
                }

                case constants.commSubjects.REQUEST.USER_DATA: {
                    response(await getStorage('userData'))
                    break
                }

                case constants.commSubjects.REQUEST.ALL_DATA: {
                    const extensionData = await getStorage('extensionData')
                    if (extensionData?.extensionEnabled) {
                        response({
                            userData: await getStorage('userData'),
                            settingsData: await getStorage('settingsData'),
                            extensionData
                        })
                    } else {
                        response({
                            userData: await getStorage('userData'),
                            settingsData: extensionDisabledData.settingsData,
                            extensionData: extensionDisabledData.extensionData
                        })
                    }
                    break
                }

                default:
                    response('unknown message subject')
            }
        } catch (error) {
            console.error('background: message handler error', error)
            response({ error: String(error) })
        }
    })()

    // Keep the message channel open for async response
    return true
})
