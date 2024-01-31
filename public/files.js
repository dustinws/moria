import * as mani from "./js/manifest.js";

window.addEventListener('DOMContentLoaded', async () => {
    const account = window.location.pathname.split('/').pop();
    const passphrase = localStorage.getItem(`moria.${account}.pp`);
    if (passphrase === null) {
        alert("Your passphrase wasn't found, this is a bug. Please report it to the developer.");
        window.location.href = '/';
        return;
    }

    let manifest;
    try {
        manifest = await mani.read(account, await deriveKey(passphrase));
    } catch (e) {
        alert("Failed to decrypt manifest. Please check your passphrase.");
        window.location.href = '/';
    }

    const button = document.getElementById('upload-button');

    button.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    Object.values(manifest).forEach((entry) => {
        const el = document.createElement('div');

        el.innerHTML = `
            <div class="flex p-6 items-center border-b-slate-100 border-b-2 w-full justify-between text-lg h-16 hover:bg-slate-100">
                <div class="w-[40%] flex items-center space-x-4">
                    <img class="h-6" src="/assets/vector/file.svg" alt="File" />
                    <div id="name" class="cursor-pointer hover:text-xl hover:font-bold">${entry.name}</div>
                </div>
                <div class="w-[20%] text-center">${entry.type}</div>
                <div class="w-[20%] text-center">${prettySize(entry.size)}</div>
                <div class="flex items-center justify-center space-x-8 w-[20%]">
                    <img id="download" class="h-5 hover:h-6 cursor-pointer" src="/assets/vector/download.svg" alt="Download" />
                    <img id="delete" class="h-5 hover:h-6 cursor-pointer" src="/assets/vector/trash.svg" alt="Delete" />
                </div>
            </div>
        `;

        el.querySelector('#name').addEventListener('click', async () => {
            const key = await deriveKey(passphrase);

            const res = await fetch('/download/' + entry.nameHash);

            const data = await res.arrayBuffer();

            const iv = new Uint8Array(entry.iv);

            let plaintext;
            try {
                plaintext = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    data,
                );
            } catch (error) {
                alert("Failed to decrypt file. Please check your passphrase and try again.");
                return;
            }

            const blob = new Blob([plaintext], { type: entry.type });

            const url = URL.createObjectURL(blob);

            window.open(url, '_blank').focus();

            URL.revokeObjectURL(url);
        });

        el.querySelector("#download").addEventListener('click', async () => {
            const key = await deriveKey(passphrase);

            const res = await fetch('/download/' + entry.nameHash);

            const data = await res.arrayBuffer();

            const iv = new Uint8Array(entry.iv);

            let plaintext;
            try {
                plaintext = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    data,
                );
            } catch (error) {
                alert("Failed to decrypt file. Please check your passphrase and try again.");
                return;
            }

            const blob = new Blob([plaintext], { type: entry.type });

            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');

            a.href = url;

            a.download = entry.name;

            a.click();

            URL.revokeObjectURL(url);
        });

        el.querySelector("#delete").addEventListener('click', async () => {
            const key = await deriveKey(passphrase);

            const res = await fetch('/delete/' + entry.nameHash, {
                method: 'POST',
            });

            const manifest = await mani.read(account, key);

            delete manifest[entry.nameHash];

            await mani.write(account, key, manifest);

            window.location.reload();
        });

        document.getElementById('files').appendChild(el);
    });

    const key = await deriveKey(passphrase);

    const $fileInput = document.getElementById('file-input');

    $fileInput.addEventListener('change', async (e) => {
        button.textContent = "Working...";
        button.classList.add("animate-pulse");
        if ($fileInput.files.length > 0) {
            await uploadFiles(account, key, $fileInput.files);
        }
        button.textContent = "Upload";
        button.classList.remove("animate-pulse");
    });
});

async function uploadFiles(account, key, files) {
    const manifest = await mani.read(account, key);
    console.log('upload file 146', { manifest })

    for (const file of files) {
        const contentsArrBuf = await readFile(file);

        const contentsUint8Arr = new Uint8Array(contentsArrBuf);

        const { iv, ciphertext } = await encrypt(key, contentsUint8Arr);

        const ciphertextUint8Arr = new Uint8Array(ciphertext);

        const contents = new Blob([ciphertextUint8Arr]);

        const entry = {
            name: file.name,
            type: file.type,
            size: file.size,
            iv: Array.from(iv),
            lastModified: file.lastModified,
            nameHash: await sha256Str(account + Date.now() + file.name),
        };

        manifest[entry.nameHash] = entry;
        console.log('writing manifest 169', { manifest })

        await fetch('/upload/' + entry.nameHash, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: contents,
        });
    }
    await mani.write(account, key, manifest);
    window.location.reload();
}

async function encrypt(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const alg = { name: 'AES-GCM', iv: iv };

    const ciphertext = await crypto.subtle.encrypt(alg, key, data);

    return { iv, ciphertext };
}

async function deriveKey(passphrase) {
    return crypto.subtle.importKey(
        "raw",
        await sha256(passphrase),
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener('load', (e) => {
            resolve(e.target.result);
        });

        reader.addEventListener('error', (e) => {
            reject(e);
        });

        reader.readAsArrayBuffer(file);
    });
}

// Given a string, return the SHA-256 hash of the string.
async function sha256(str) {
    // Convert the raw string into a typed array of 8-bit unsigned integers.
    const msgUint8 = new TextEncoder().encode(str);

    // Use the crypto.subtle API to create a SHA-256 hash of the message.
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);

    // The hashBuffer returned from the digest() method is an ArrayBuffer.
    // In order to transmit the data, it needs to be converted to a string.
    // We do this by converting the ArrayBuffer to a typed array and then
    // converting the typed array to a normal array that we can map over.
    return new Uint8Array(hashBuffer);
}

// Given a string, return the SHA-256 hash of the string.
async function sha256Str(str) {
    // Convert the raw string into a typed array of 8-bit unsigned integers.
    const msgUint8 = new TextEncoder().encode(str);

    // Use the crypto.subtle API to create a SHA-256 hash of the message.
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);

    // The hashBuffer returned from the digest() method is an ArrayBuffer.
    // In order to transmit the data, it needs to be converted to a string.
    // We do this by converting the ArrayBuffer to a typed array and then
    // converting the typed array to a normal array that we can map over.
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Convert the array of numbers into a string of hexadecimal values.
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Finally, we can return the hash string to the calling function.
    return hashHex;
}

function prettySize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

window.deriveKey = deriveKey;
