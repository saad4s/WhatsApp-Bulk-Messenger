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

async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }
    try {
        const response = await fetch(`/message-history/${messageId}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to delete message');
        }

        await loadMessageHistory();
    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Error deleting message: ' + error.message);
    }
}

// Function to show contact details modal
function showContactDetails(details, type) {
    // Remove any existing modal
    const existingModal = document.getElementById('contactModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="contactModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="text-xl font-bold">${type} Contacts (${details.length})</h3>
                    <button onclick="document.getElementById('contactModal').remove()" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div class="p-4 overflow-auto">
                    <div class="space-y-2">
                        ${details.map(contact => `
                            <div class="p-3 ${contact.status === 'success' ? 'bg-green-50' : 'bg-red-50'} rounded-lg">
                                <div class="font-medium">${contact.name}</div>
                                <div class="text-gray-600">${contact.number}</div>
                                ${contact.error ? `
                                    <div class="text-red-500 text-sm mt-1">${contact.error}</div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="p-4 border-t border-gray-200">
                    <button 
                        onclick="document.getElementById('contactModal').remove()" 
                        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
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

        const historyHTML = data.history.map(item => {
            const successDetails = item.report.details.filter(d => d.status === 'success');
            const failedDetails = item.report.details.filter(d => d.status === 'failed');
            const totalDetails = item.report.details;

            return `
        <div class="history-item">
            <div class="history-item-header">
                <span class="history-timestamp">${formatDate(item.timestamp)}</span>
                <button 
                    type="button"
                    onclick="deleteMessage('${item.id}')"
                    class="delete-btn text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    Delete
                </button>
            </div>
            <div class="history-message">${item.message}</div>
            <div class="history-stats">
                <div class="stat-item total cursor-pointer" 
                     onclick='showContactDetails(${JSON.stringify(totalDetails).replace(/'/g, "&apos;")}, "Total")'>
                    <div class="font-bold">${item.report.total}</div>
                    <div class="text-sm">Total</div>
                </div>
                <div class="stat-item success cursor-pointer" 
                     onclick='showContactDetails(${JSON.stringify(successDetails).replace(/'/g, "&apos;")}, "Successful")'>
                    <div class="font-bold">${item.report.successful}</div>
                    <div class="text-sm">Successful</div>
                    
                </div>
                <div class="stat-item failed cursor-pointer"
                     onclick='showContactDetails(${JSON.stringify(failedDetails).replace(/'/g, "&apos;")}, "Failed")'>
                    <div class="font-bold">${item.report.failed}</div>
                    <div class="text-sm">Failed</div>
                  
                </div>
            </div>
        </div>
    `;
        }).join('');

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
document.getElementById('refreshHistory').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent form submission
    loadMessageHistory();
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

// Image upload handling
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.querySelector('.image-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('removeImage').addEventListener('click', function() {
    document.getElementById('imageUpload').value = '';
    document.getElementById('imagePreview').src = '';
    document.querySelector('.image-preview').classList.add('hidden');
});

// Template management
document.getElementById('templateSelect').addEventListener('change', function() {
    const selectedTemplate = templates.find(t => t.name === this.value);
    if (selectedTemplate) {
        document.getElementById('message').value = selectedTemplate.content;
    }
});

document.getElementById('editTemplate').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent form submission
    const selectedTemplate = document.getElementById('templateSelect').value;
    if (selectedTemplate) {
        const template = templates.find(t => t.name === selectedTemplate);
        document.getElementById('templateName').value = template.name;
        document.getElementById('templateContent').value = template.content;
        document.querySelector('.template-form').classList.remove('hidden');
    }
});

document.getElementById('saveTemplate').addEventListener('click', async function() {
    const name = document.getElementById('templateName').value;
    const content = document.getElementById('templateContent').value;
    if (name && content) {
        try {
            const response = await fetch('/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, content })
            });
            const data = await response.json();
            updateTemplateList(data.templates);
            document.querySelector('.template-form').classList.add('hidden');
        } catch (error) {
            alert('Error saving template: ' + error.message);
        }
    }
});

document.getElementById('deleteTemplate').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent form submission
    const selectedTemplate = document.getElementById('templateSelect').value;
    if (selectedTemplate) {
        if (!confirm('Are you sure you want to delete this template?')) {
            return;
        }
        try {
            fetch(`/template/${selectedTemplate}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => updateTemplateList(data.templates))
            .catch(error => alert('Error deleting template: ' + error.message));
        } catch (error) {
            alert('Error deleting template: ' + error.message);
        }
    }
});

async function updateTemplateList(templates) {
    const select = document.getElementById('templateSelect');
    select.innerHTML = '<option value="">Select a template</option>';
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.name;
        option.textContent = template.name;
        select.appendChild(option);
    });
}

// Fetch templates on load
fetch('/templates')
    .then(response => response.json())
    .then(data => updateTemplateList(data.templates));

// Form submission
document.getElementById('messageForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('contactFile', document.getElementById('contactFile').files[0]);
    formData.append('message', document.getElementById('message').value);
    
    const imageFile = document.getElementById('imageUpload').files[0];
    if (imageFile) {
        formData.append('imageFile', imageFile);
    }

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

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Error uploading file');
        }

        const uploadData = await uploadResponse.json();

        // Send messages
        const sendResponse = await fetch('/send-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contacts: uploadData.contacts,
                message: document.getElementById('message').value,
                messageFile: uploadData.messageFile,
                imageFile: uploadData.imageFile // Pass the image filename if it exists
            })
        });

        if (!sendResponse.ok) {
            const errorData = await sendResponse.json();
            throw new Error(errorData.error || 'Error sending messages');
        }

        const sendData = await sendResponse.json();

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
            document.querySelector('.image-preview').classList.add('hidden');

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