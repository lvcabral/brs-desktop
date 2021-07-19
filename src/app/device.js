// Load Device Info and Registry
const storage = window.localStorage;
export let deviceData = {};
Object.assign(deviceData, api.getDeviceInfo(), {registry: new Map()});
for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key.substr(0, deviceData.developerId.length) === deviceData.developerId) {
        deviceData.registry.set(key, storage.getItem(key));
    }
}
