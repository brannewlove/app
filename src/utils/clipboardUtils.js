/**
 * Clipboard utility to support both modern and legacy browsers, 
 * including non-secure contexts (HTTP) where navigator.clipboard is unavailable.
 */

export const copyToClipboard = async (text) => {
    // Try modern navigator.clipboard API if available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('navigator.clipboard failed, trying fallback:', err);
        }
    }

    // Fallback for non-secure contexts (HTTP) or older browsers
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // Ensure the textarea is not visible or affecting layout
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) return true;
        throw new Error('execCommand copy returned false');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        return false;
    }
};

/**
 * Advanced copy for multiple MIME types (HTML, etc.)
 * Note: Legacy fallback only supports plain text.
 */
export const copyRichToClipboard = async (richData) => {
    // 1. Try modern navigator.clipboard API (requires HTTPS/Secure Context)
    if (navigator.clipboard && window.isSecureContext && window.ClipboardItem) {
        try {
            const clipboardItems = [];
            const types = Object.keys(richData);
            const itemData = {};

            for (const type of types) {
                const blob = new Blob([richData[type]], { type });
                itemData[type] = blob;
            }

            clipboardItems.push(new window.ClipboardItem(itemData));
            await navigator.clipboard.write(clipboardItems);
            return true;
        } catch (err) {
            console.warn('copyRichToClipboard (modern) failed, trying fallback:', err);
        }
    }

    // 2. Fallback for non-secure contexts (HTTP) or older browsers
    try {
        // Create a temporary container for copying
        const container = document.createElement('div');

        if (richData['text/html']) {
            // HTML Copying: Create a hidden element with HTML content
            container.innerHTML = richData['text/html'];
        } else if (richData['text/plain']) {
            // Plain text only fallback
            container.innerText = richData['text/plain'];
            container.style.whiteSpace = 'pre';
        } else {
            return false;
        }

        // Hide the container
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';

        document.body.appendChild(container);

        // Select the content
        const range = document.createRange();
        range.selectNodeContents(container);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Execute copy command
        const successful = document.execCommand('copy');

        // Cleanup
        selection.removeAllRanges();
        document.body.removeChild(container);

        if (successful) return true;

        // Final fallback: Try legacy textarea if execCommand copy failed on div
        if (richData['text/plain']) {
            return copyToClipboard(richData['text/plain']);
        }
    } catch (err) {
        console.error('copyRichToClipboard (fallback) failed:', err);
        // Final fallback: Try legacy textarea
        if (richData['text/plain']) {
            return copyToClipboard(richData['text/plain']);
        }
    }

    return false;
};
