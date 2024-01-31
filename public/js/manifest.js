const MANIFEST_KEY = 'moria.manifest';

export async function write(account, key, manifest) {
    // Create the initial vector for the encryption.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivArr = Array.from(iv);

    // Convert the manifest to a typed array of 8-bit unsigned integers.
    const plaintext = new TextEncoder().encode(JSON.stringify(manifest));

    // Encrypt the manifest.
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        plaintext,
    );

    // Convert the encrypted manifest and initial vector to a JSON string.
    const payload = JSON.stringify({
        iv: ivArr,
        cipher: Array.from(new Uint8Array(ciphertext)),
    });

    // Save the encrypted manifest to local storage.
    localStorage.setItem(createKey(account), payload);

    return true;
}

export async function read(account, key) {
    const manifestPayload = localStorage.getItem(createKey(account));

    if (!manifestPayload) {
        return {};
    }

    const manifest = JSON.parse(manifestPayload);

    // Convert the initial vector to a Uint8Array.
    const iv = new Uint8Array(manifest.iv);

    // Convert the cipher to a Uint8Array.
    const cipher = new Uint8Array(manifest.cipher);

    // Decrypt the manifest.
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        cipher,
    );

    // Convert the plaintext to a string.
    const plaintextStr = new TextDecoder().decode(plaintext);
    console.log(JSON.parse(plaintextStr));

    // Convert the plaintext string to a manifest object.
    return JSON.parse(plaintextStr);
}

function createKey(account) {
    return `${MANIFEST_KEY}.${account}`
}

window.manifest = {
    read,
    write,
};