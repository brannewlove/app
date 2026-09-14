/**
 * Clipboard utility to support both modern (HTTPS) and legacy/HTTP environments,
 * ensuring rich HTML formatting (tables) and plain text are reliably copied.
 */

export const copyToClipboard = async (text) => {
    if (text === null || text === undefined) return false;

    // 1. Try modern navigator.clipboard API if available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('navigator.clipboard failed, trying fallback:', err);
        }
    }

    // Clear existing window selection to avoid copying accidentally highlighted text
    try {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
    } catch (e) {}

    // 2. Selection + Copy Event Listener Fallback (Most reliable across all browsers & HTTP)
    let copied = false;
    const handleCopy = (e) => {
        try {
            e.preventDefault();
            e.clipboardData.setData('text/plain', text);
            copied = true;
        } catch (evtErr) {
            console.warn('Error in plain copy event handler:', evtErr);
        }
    };

    let tempEl = null;
    try {
        tempEl = document.createElement('textarea');
        tempEl.value = text;
        tempEl.setAttribute('readonly', '');
        tempEl.style.position = 'fixed';
        tempEl.style.top = '0';
        tempEl.style.left = '0';
        tempEl.style.width = '2em';
        tempEl.style.height = '2em';
        tempEl.style.padding = '0';
        tempEl.style.border = 'none';
        tempEl.style.outline = 'none';
        tempEl.style.boxShadow = 'none';
        tempEl.style.background = 'transparent';
        tempEl.style.opacity = '0.01';
        tempEl.style.zIndex = '999999';

        document.body.appendChild(tempEl);
        tempEl.focus();
        tempEl.select();
        tempEl.setSelectionRange(0, tempEl.value.length);

        document.addEventListener('copy', handleCopy);
        const successful = document.execCommand('copy');
        document.removeEventListener('copy', handleCopy);

        if (successful || copied) return true;
    } catch (err) {
        console.error('All copy fallbacks failed:', err);
    } finally {
        if (tempEl && tempEl.parentNode) {
            tempEl.parentNode.removeChild(tempEl);
        }
    }

    // 3. Fallback: Direct navigator.clipboard.writeText if available
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {}
    }

    return false;
};

/**
 * Advanced copy for multiple MIME types (HTML, Plain Text, etc.)
 * Perfect for pasting styled tables into Excel, Outlook, Google Sheets, etc.
 */
export const copyRichToClipboard = async (richData) => {
    if (!richData) return false;

    // 1. Try modern navigator.clipboard API (requires HTTPS/Secure Context and ClipboardItem)
    if (navigator.clipboard && window.isSecureContext && typeof window.ClipboardItem !== 'undefined') {
        try {
            const itemData = {};
            for (const type of Object.keys(richData)) {
                itemData[type] = new Blob([richData[type]], { type });
            }
            await navigator.clipboard.write([new window.ClipboardItem(itemData)]);
            return true;
        } catch (err) {
            console.warn('copyRichToClipboard (modern) failed, trying fallback:', err);
        }
    }

    // Clear existing window selection to avoid copying accidentally highlighted text
    try {
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
    } catch (e) {}

    // 2. High-reliability Fallback: Active Selection + Copy Event Interceptor
    let copied = false;
    const handleCopy = (e) => {
        try {
            e.preventDefault();
            if (richData['text/html']) {
                e.clipboardData.setData('text/html', richData['text/html']);
            }
            if (richData['text/plain']) {
                e.clipboardData.setData('text/plain', richData['text/plain']);
            }
            copied = true;
        } catch (evtErr) {
            console.warn('Error in rich copy event handler:', evtErr);
        }
    };

    let tempEl = null;
    try {
        tempEl = document.createElement('textarea');
        tempEl.value = richData['text/plain'] || ' ';
        tempEl.setAttribute('readonly', '');
        tempEl.style.position = 'fixed';
        tempEl.style.top = '0';
        tempEl.style.left = '0';
        tempEl.style.width = '2em';
        tempEl.style.height = '2em';
        tempEl.style.opacity = '0.01';
        tempEl.style.zIndex = '999999';

        document.body.appendChild(tempEl);
        tempEl.focus();
        tempEl.select();
        tempEl.setSelectionRange(0, tempEl.value.length);

        document.addEventListener('copy', handleCopy);
        const successful = document.execCommand('copy');
        document.removeEventListener('copy', handleCopy);

        if (successful || copied) return true;
    } catch (err) {
        console.warn('Rich copy fallback with selection failed:', err);
    } finally {
        if (tempEl && tempEl.parentNode) {
            tempEl.parentNode.removeChild(tempEl);
        }
    }

    // 3. Fallback: DOM Range Selection on ContentEditable HTML Container
    if (richData['text/html']) {
        let container = null;
        try {
            container = document.createElement('div');
            container.innerHTML = richData['text/html'];
            container.contentEditable = 'true';
            container.style.position = 'fixed';
            container.style.left = '0';
            container.style.top = '0';
            container.style.width = '1px';
            container.style.height = '1px';
            container.style.opacity = '0.01';
            container.style.overflow = 'hidden';
            container.style.zIndex = '999999';

            document.body.appendChild(container);
            container.focus();

            const range = document.createRange();
            range.selectNodeContents(container);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }

            const successful = document.execCommand('copy');
            if (sel) sel.removeAllRanges();

            if (successful) return true;
        } catch (domErr) {
            console.warn('DOM Range copy fallback failed:', domErr);
        } finally {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }
    }

    // 4. Final Fallback: Plain text copy
    if (richData['text/plain']) {
        return copyToClipboard(richData['text/plain']);
    }

    return false;
};
