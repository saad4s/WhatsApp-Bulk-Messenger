// Initialize Socket.io
const socket = io();

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to load message history
async function loadMessageHistory() {
    try {
        const historyContent = document.getElementById('historyContent');
        historyContent.innerHTML = '<div class="loading-spinner"></div>';

        const response = await fetch('/message-history');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load message history');
        }

        if (data.history.length === 0) {
            historyContent.innerHTML = '<p class="text-gray-500 text-center">No message history found</p>';
            return;
        }

        const historyHTML = data.history.map(item => `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-timestamp">${formatDate(item.timestamp)}</span>
                </div>
                <div class="history-message">${item.message}</div>
                <div class="history-stats">
                    <div class="stat-item total">
                        <div class="font-bold">${item.report.total}</div>
                        <div class="text-sm">Total</div>
                    </div>
                    <div class="stat-item success">
                        <div class="font-bold">${item.report.successful}</div>
                        <div class="text-sm">Successful</div>
                    </div>
                    <div class="stat-item failed">
                        <div class="font-bold">${item.report.failed}</div>
                        <div class="text-sm">Failed</div>
                    </div>
                </div>
            </div>
        `).join('');

        historyContent.innerHTML = historyHTML;
    } catch (error) {
        console.error('Error loading message history:', error);
        document.getElementById('historyContent').innerHTML = `
            <div class="text-red-500 text-center">
                Error loading message history: ${error.message}
            </div>
        `;
    }
}





// Function to check client status and update UI
async function checkStatus() {
    try {
        const response = await fetch('/status');
        const data = await response.json();

        // Update status display
        const statusValue = document.getElementById('statusValue');
        const logoutBtn = document.getElementById('logoutBtn');

        statusValue.textContent = data.isClientReady ? 'True' : 'False';
        statusValue.className = data.isClientReady ? 'font-medium text-green-600' : 'font-medium text-red-600';

        // Show/hide logout button based on client status
        logoutBtn.classList.toggle('hidden', !data.isClientReady);

        if (data.isClientReady) {
            // Hide QR section and show message section
            document.getElementById('qrSection').classList.add('hidden');
            document.getElementById('messageSection').classList.remove('hidden');
        } else if (data.qrCode) {
            // Show QR code
            document.getElementById('qrCode').innerHTML = `<img src="${data.qrCode}" alt="QR Code" class="max-w-xs">`;
            document.getElementById('loadingText').classList.add('hidden');
        }

        // If not ready, keep checking
        if (!data.isClientReady) {
            setTimeout(checkStatus, 1000);
        }
    } catch (error) {
        console.error('Error checking status:', error);
        setTimeout(checkStatus, 1000);
    }
}

// Socket events
socket.on('ready', () => {
    document.getElementById('logoutBtn').classList.remove('hidden');
    checkStatus();
});

socket.on('disconnected', () => {
    document.getElementById('logoutBtn').classList.add('hidden');
    checkStatus();
});

// Character counter functionality
document.getElementById('message').addEventListener('input', function(e) {
    const charCount = e.target.value.length;
    document.getElementById('charCount').textContent = charCount;
});

// Refresh button handler
document.getElementById('refreshHistory').addEventListener('click', loadMessageHistory);

// File upload handling
document.getElementById('contactFile').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name;
    if (fileName) {
        document.getElementById('fileName').textContent = fileName;
        document.querySelector('.file-info').classList.remove('hidden');
    }
});

document.getElementById('removeFile').addEventListener('click', function() {
    document.getElementById('contactFile').value = '';
    document.querySelector('.file-info').classList.add('hidden');
});

// Form submission
document.getElementById('messageForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('contactFile', document.getElementById('contactFile').files[0]);
    formData.append('message', document.getElementById('message').value);

    // Show loading state
    const sendButton = document.getElementById('sendButton');
    const buttonText = sendButton.querySelector('.button-text');
    const loadingSpinner = sendButton.querySelector('.loading-spinner');

    buttonText.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    sendButton.disabled = true;

    try {
        // Upload file and get contacts
        const uploadResponse = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
            throw new Error(uploadData.error || 'Error uploading file');
        }

        // Send messages
        const message = document.getElementById('message').value;
        // In your app.js, modify the send-messages fetch call
        const sendResponse = await fetch('/send-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contacts: uploadData.contacts,
                message,
                messageFile: uploadData.messageFile
            })
        });
        const sendData = await sendResponse.json();

        if (!sendData.success) {
            throw new Error(sendData.error || 'Error sending messages');
        }

        // Display report
        const reportDiv = document.getElementById('report');
        const reportContent = document.getElementById('reportContent');

        reportDiv.classList.remove('hidden');
        reportContent.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-green-50 p-4 rounded-lg">
                        <p class="text-lg font-semibold text-green-700">Total: ${sendData.report.total}</p>
                    </div>
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <p class="text-lg font-semibold text-blue-700">Successful: ${sendData.report.successful}</p>
                    </div>
                    <div class="bg-red-50 p-4 rounded-lg">
                        <p class="text-lg font-semibold text-red-700">Failed: ${sendData.report.failed}</p>
                    </div>
                </div>
                <div class="mt-6">
                    <h3 class="text-lg font-semibold mb-3">Detailed Report</h3>
                    <ul class="space-y-2">
                        ${sendData.report.details.map(detail => `
                            <li class="p-3 rounded-lg ${detail.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
                                ${detail.name} (${detail.number}): ${detail.status}
                                ${detail.error ? `<br><span class="text-sm opacity-75">Error: ${detail.error}</span>` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;


        await loadMessageHistory();

    } catch (error) {
        alert(error.message);
    } finally {
        // Reset button state
        buttonText.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        sendButton.disabled = false;
    }
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout from WhatsApp?')) {
        return;
    }

    try {
        const response = await fetch('/logout', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            // Reset UI state
            document.getElementById('messageSection').classList.add('hidden');
            document.getElementById('qrSection').classList.remove('hidden');
            document.getElementById('loadingText').classList.remove('hidden');
            document.getElementById('qrCode').innerHTML = '';
            document.getElementById('report').classList.add('hidden');
            document.getElementById('logoutBtn').classList.add('hidden');

            // Clear any existing form data
            document.getElementById('messageForm').reset();
            document.querySelector('.file-info').classList.add('hidden');

            // Restart status checking
            checkStatus();
        } else {
            throw new Error(data.error || 'Failed to logout');
        }
    } catch (error) {
        alert('Error logging out: ' + error.message);
    }
});

// Initialize socket event handlers
socket.on('qr', (qr) => {
    document.getElementById('qrCode').innerHTML = `<img src="${qr}" alt="QR Code" class="max-w-xs">`;
    document.getElementById('loadingText').classList.add('hidden');
});

socket.on('qrDataUrl', (qrDataUrl) => {
    document.getElementById('qrCode').innerHTML = `<img src="${qrDataUrl}" alt="QR Code" class="max-w-xs">`;
    document.getElementById('loadingText').classList.add('hidden');
});

socket.on('auth_failure', () => {
    alert('WhatsApp authentication failed. Please try again.');
    checkStatus();
});

// Load history when client is ready
socket.on('ready', () => {
    loadMessageHistory();
});

// Start checking status when page loads
checkStatus();