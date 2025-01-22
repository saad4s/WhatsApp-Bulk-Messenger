// Function to check client status and update UI
async function checkStatus() {
    try {
        const response = await fetch('/status');
        const data = await response.json();

        // Update status display
        const statusValue = document.getElementById('statusValue');
        statusValue.textContent = data.isClientReady ? 'True' : 'False';
        statusValue.className = data.isClientReady ? 'font-medium text-green-600' : 'font-medium text-red-600';

        if (data.isClientReady) {
            // Hide QR section and show message section
            document.getElementById('qrSection').classList.add('hidden');
            document.getElementById('messageSection').classList.remove('hidden');
        } else if (data.qrCode) {
            // Show QR code
            document.getElementById('qrCode').innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
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

// Character counter functionality
document.getElementById('message').addEventListener('input', function(e) {
    const charCount = e.target.value.length;
    document.getElementById('charCount').textContent = charCount;
});

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
            throw new Error('Error uploading file: ' + uploadData.error);
        }

        // Send messages
        const message = document.getElementById('message').value;
        const sendResponse = await fetch('/send-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contacts: uploadData.contacts,
                message
            })
        });
        const sendData = await sendResponse.json();

        // Display report
        const reportDiv = document.getElementById('report');
        const reportContent = document.getElementById('reportContent');
        reportDiv.classList.remove('hidden');

        reportContent.innerHTML = `
            <p>Total messages: ${sendData.report.total}</p>
            <p>Successful: ${sendData.report.successful}</p>
            <p>Failed: ${sendData.report.failed}</p>
            <div class="mt-4">
                <h3 class="font-bold">Details:</h3>
                <ul class="list-disc pl-5">
                    ${sendData.report.details.map(detail => `
                        <li class="${detail.status === 'success' ? 'text-green-600' : 'text-red-600'}">
                            ${detail.name} (${detail.number}): ${detail.status}
                            ${detail.error ? `- Error: ${detail.error}` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
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

// Start checking status when page loads
checkStatus();