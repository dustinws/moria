document.addEventListener('DOMContentLoaded', function () {
    const $connectionForm = document.getElementById('connection-form');

    $connectionForm.addEventListener('submit', async (e) => {
        console.debug("[DEBUG] Intercepted form submission.");
        const $passphrase = document.querySelector('#connection-form input[name="passphrase"]');

        const $account = document.querySelector('#connection-form input[name="fingerprint"]');
        if ($account.value === '') {
            $account.value = generateAccount();
            alert('Your account number is ' + $account.value);
        }

        console.debug("[DEBUG] Checking if form contains passphrase.");
        if ($passphrase !== null) {
            // Intercept the default behavior of submitting the form so that we
            // can perform our own logic.
            console.debug("[DEBUG] Form contains passphrase - stopping submit.");
            e.preventDefault();
        }

        // First, we need to remove the passphrase input from the form.
        // This will prevent it from being sent to the server. Instead, we will
        // hash the passphrase and store the hash in local storage so that it
        // can be used to decrypt files later on.
        console.debug("[DEBUG] Removing passphrase input from form.");
        // $connectionForm.removeChild($passphrase);

        // Next, we need to hash the passphrase and store it in local storage.
        console.debug("[DEBUG] Setting hashed passphrase in local storage.");
        const passphraseHash = await sha256($passphrase.value);
        console.log(passphraseHash);
        localStorage.setItem(`moria.${$account.value}.pp`, passphraseHash);

        // Finally, we can submit the form.
        console.debug("[DEBUG] Submitting form.");
        $connectionForm.submit();
    });
});

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
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Convert the array of numbers into a string of hexadecimal values.
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Finally, we can return the hash string to the calling function.
    return hashHex;
}

function generateAccount() {
    let account = '';
    for (let i = 0; i < 19; i++) {
        if ([4, 9, 14].includes(i)) {
            account += '-';
        } else {
            account += Math.floor(Math.random() * 10);
        }
    }
    return account;
}