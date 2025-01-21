// DOM Elements
const form = document.getElementById('messageForm');
const fileInput = document.getElementById('contactFile');
const fileInfo = document.querySelector('.file-info');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const messageInput = document.getElementById('message');
const charCount = document.getElementById('charCount');
const sendButton = document.getElementById('sendButton');
const buttonText = document.querySelector('.button-text');
const loadingSpinner = document.querySelector('.loading-spinner');
const logoutBtn = document.getElementById('logoutBtn');
const statusMessage = document.getElementById('statusMessage');
const reportDiv = document.getElementById('report');
const reportContent = document.getElementById('reportContent');

// File Upload Handling
fileInput.addEventListener('change', handleFileSelect);
removeFile.addEventListener('click', handleFileRemove);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        updateSendButton();
    }
}

function handleFileRemove() {
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    updateSendButton();
}

// Message Character Counter
messageInput.addEventListener('input', () => {
    const length = messageInput.value.length;
    charCount.textContent = length;
    updateSendButton();
});

function updateSendButton() {
    sendButton.disabled = !fileInput.value || !messageInput.value.trim();
}

// Status Message Handler
function showStatus(message, type = 'error') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}-message animate__animated animate__fadeIn`;
    setTimeout(() => {
        statusMessage.classList.add('animate__fadeOut');
    }, 4500);
}

// Loading State Handler
function setLoading(isLoading) {
    sendButton.disabled = isLoading;
    buttonText.classList.toggle('hidden', isLoading);
    loadingSpinner.classList.toggle('hidden', !isLoading);
    fileInput.disabled = isLoading;
    messageInput.disabled = isLoading;
}

// Report Renderer
function renderReport(report) {
    reportDiv.classList.remove('hidden');
    reportContent.innerHTML = `
        <div class="report-grid">
            <div class="report-stat">
                <span class="stat-label">Total</span>
                <span class="stat-value">${report.total}</span>
            </div>
            <div class="report-stat success">
                <span class="stat-label">Sent</span>
                <span class="stat-value">${report.successful}</span>
            </div>
            <div class="report-stat error">
                <span class="stat-label">Failed</span>
                <span class="stat-value">${report.failed || 0}</span>
            </div>
        </div>
        <div class="report-details">
            ${report.details.map(detail => `
                <div class="report-item ${detail.status}">
                    <span class="status-dot"></span>
                    <div class="report-item-content">
                        <div class="report-item-name">${detail.name}</div>
                        <div class="report-item-number">${detail.number}</div>
                        ${detail.error ? `<div class="report-item-error">${detail.error}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Form Submit Handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        // Upload file
        const formData = new FormData();
        formData.append('contactFile', fileInput.files[0]);

        const uploadResponse = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) throw new Error('File upload failed');
        const uploadData = await uploadResponse.json();

        // Send messages
        const sendResponse = await fetch('/send-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contacts: uploadData.contacts,
                message: messageInput.value.trim()
            })
        });

        if (!sendResponse.ok) throw new Error('Failed to send messages');
        const sendData = await sendResponse.json();

        // Show report
        renderReport(sendData.report);
        showStatus('Messages sent successfully', 'success');
        form.reset();
        fileInfo.classList.add('hidden');
        updateSendButton();

    } catch (error) {
        showStatus(error.message);
        console.error('Error:', error);
    } finally {
        setLoading(false);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', async () => {
    try {
        logoutBtn.disabled = true;
        const response = await fetch('/logout', { method: 'POST' });

        if (!response.ok) throw new Error('Logout failed');
        const data = await response.json();

        if (data.success) {
            window.location.href = '/qr';
        } else {
            throw new Error(data.error || 'Logout failed');
        }
    } catch (error) {
        showStatus(error.message);
    } finally {
        logoutBtn.disabled = false;
    }
});