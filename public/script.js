// Global variables
let currentUser = null;
let cooldownInterval = null;

// Utility functions
function showToast(title, description, type = 'default') {
    const toast = document.getElementById('toast');
    const toastTitle = toast.querySelector('.toast-title');
    const toastDescription = toast.querySelector('.toast-description');
    
    toastTitle.textContent = title;
    toastDescription.textContent = description;
    
    toast.classList.remove('error', 'success');
    if (type === 'error') {
        toast.classList.add('error');
    } else if (type === 'success') {
        toast.classList.add('success');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

function showSuccessNotification() {
    const notification = document.getElementById('successNotification');
    if (notification) {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
}

// Auth service
const authService = {
    getStoredUser() {
        const userData = localStorage.getItem('joomodss_user');
        return userData ? JSON.parse(userData) : null;
    },

    isLoggedIn() {
        return localStorage.getItem('joomodss_session') === 'active';
    },

    login(user) {
        localStorage.setItem('joomodss_session', 'active');
        localStorage.setItem('joomodss_user', JSON.stringify(user));
        currentUser = user;
    },

    logout() {
        localStorage.removeItem('joomodss_session');
        localStorage.removeItem('joomodss_user');
        localStorage.removeItem('joomodss_last_submit');
        currentUser = null;
        window.location.href = '/';
    },

    getCurrentUser() {
        if (!this.isLoggedIn()) return null;
        return this.getStoredUser();
    }
};

// Cooldown service
const cooldownService = {
    COOLDOWN_MINUTES: 30,

    getLastSubmissionTime() {
        const time = localStorage.getItem('joomodss_last_submit');
        return time ? parseInt(time) : null;
    },

    setLastSubmissionTime() {
        localStorage.setItem('joomodss_last_submit', Date.now().toString());
    },

    isInCooldown() {
        const lastSubmission = this.getLastSubmissionTime();
        if (!lastSubmission) return false;

        const timeDiff = Date.now() - lastSubmission;
        const minutesPassed = timeDiff / (1000 * 60);
        
        return minutesPassed < this.COOLDOWN_MINUTES;
    },

    getRemainingCooldownTime() {
        const lastSubmission = this.getLastSubmissionTime();
        if (!lastSubmission) return { minutes: 0, seconds: 0 };

        const timeDiff = Date.now() - lastSubmission;
        const minutesPassed = timeDiff / (1000 * 60);
        
        if (minutesPassed >= this.COOLDOWN_MINUTES) {
            return { minutes: 0, seconds: 0 };
        }

        const remainingMinutes = this.COOLDOWN_MINUTES - minutesPassed;
        const minutes = Math.floor(remainingMinutes);
        const seconds = Math.floor((remainingMinutes - minutes) * 60);
        
        return { minutes, seconds };
    }
};

// API service
async function apiRequest(method, endpoint, data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);
    return response;
}

// Login page functionality
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (!loginForm) return;

    // Check if already logged in
    if (authService.isLoggedIn()) {
        window.location.href = '/dashboard';
        return;
    }

    // Show/Hide register form
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const loginCard = document.querySelector('.login-section');
    const registerCard = document.querySelector('.register-section');

    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', () => {
            loginCard.style.display = 'none';
            registerCard.style.display = 'block';
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            registerCard.style.display = 'none';
            loginCard.style.display = 'block';
        });
    }

    // Login form handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            showToast('Error', 'Please fill in all fields', 'error');
            return;
        }

        const loginBtn = loginForm.querySelector('button[type="submit"]');
        const originalContent = loginBtn.innerHTML;
        
        // Show loading state
        loginBtn.disabled = true;
        loginBtn.innerHTML = `
            <div class="loading-spinner"></div>
            Logging in...
        `;

        try {
            const response = await apiRequest('POST', '/api/login', {
                username,
                password,
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                authService.login(data.user);
                window.location.href = '/dashboard';
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            showToast('Login Failed', error.message || 'Invalid credentials', 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalContent;
        }
    });

    // Register form handler
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value.trim();
            const confirmPassword = document.getElementById('regConfirmPassword').value.trim();
            
            if (!username || !email || !password || !confirmPassword) {
                showToast('Error', 'Please fill in all fields', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showToast('Error', 'Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('Error', 'Password must be at least 6 characters long', 'error');
                return;
            }

            const registerBtn = registerForm.querySelector('button[type="submit"]');
            const originalContent = registerBtn.innerHTML;
            
            // Show loading state
            registerBtn.disabled = true;
            registerBtn.innerHTML = `
                <div class="loading-spinner"></div>
                Creating Account...
            `;

            try {
                const response = await apiRequest('POST', '/api/register', {
                    username,
                    email,
                    password,
                });

                const data = await response.json();
                
                if (response.ok && data.success) {
                    showToast('Success', 'Account created successfully! You can now login.', 'success');
                    // Switch back to login form
                    registerCard.style.display = 'none';
                    loginCard.style.display = 'block';
                    registerForm.reset();
                } else {
                    throw new Error(data.message || 'Registration failed');
                }
            } catch (error) {
                showToast('Registration Failed', error.message || 'Could not create account', 'error');
            } finally {
                registerBtn.disabled = false;
                registerBtn.innerHTML = originalContent;
            }
        });
    }
}

// Dashboard page functionality
function initDashboardPage() {
    // Check if logged in
    if (!authService.isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    currentUser = authService.getCurrentUser();
    if (!currentUser) {
        window.location.href = '/';
        return;
    }

    // Update UI with user info
    updateUserInfo();
    
    // Initialize sidebar
    initSidebar();
    
    // Initialize panels
    initPanels();
    
    // Initialize executor form
    initExecutorForm();
    
    // Initialize cooldown timer
    initCooldownTimer();
    
    // Initialize logout buttons
    initLogoutButtons();
}

function updateUserInfo() {
    const currentUserSpan = document.getElementById('currentUser');
    if (currentUserSpan) {
        currentUserSpan.textContent = currentUser.username;
    }

    // Update account panel
    const accountStatus = document.getElementById('accountStatus');
    const activeDays = document.getElementById('activeDays');
    const accessLevel = document.getElementById('accessLevel');
    const userEmail = document.getElementById('userEmail');
    const userUsername = document.getElementById('userUsername');
    const userIP = document.getElementById('userIP');

    if (accountStatus) accountStatus.textContent = `Active - ${currentUser.accessLevel}`;
    if (activeDays) activeDays.textContent = `${currentUser.activeDays} days ago`;
    if (accessLevel) accessLevel.textContent = currentUser.accessLevel;
    if (userEmail) userEmail.textContent = currentUser.email;
    if (userUsername) userUsername.textContent = currentUser.username;
    if (userIP) userIP.textContent = currentUser.ipAddress || 'N/A';
}

function initSidebar() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
        hamburgerBtn.classList.remove('open');
    }

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('show');
        hamburgerBtn.classList.add('open');
    }

    hamburgerBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    sidebarOverlay.addEventListener('click', closeSidebar);

    // Navigation buttons
    const mainDashboardBtn = document.getElementById('mainDashboardBtn');
    const accountDashboardBtn = document.getElementById('accountDashboardBtn');

    mainDashboardBtn.addEventListener('click', () => {
        showPanel('main');
        closeSidebar();
    });

    accountDashboardBtn.addEventListener('click', () => {
        showPanel('account');
        closeSidebar();
    });
}

function initPanels() {
    // Show main panel by default
    showPanel('main');
}

function showPanel(panelName) {
    // Hide all panels
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.remove('active'));

    // Show selected panel
    const targetPanel = document.getElementById(panelName + 'Panel');
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // Update navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn:not(.logout-btn)');
    navButtons.forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.getElementById(panelName + 'DashboardBtn');
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function initExecutorForm() {
    const executorForm = document.getElementById('executorForm');
    if (!executorForm) return;

    executorForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const targetNumber = document.getElementById('targetNumber').value.trim();
        const method = document.getElementById('method').value;

        if (!targetNumber || !method) {
            showToast('Error', 'Please fill in all fields', 'error');
            return;
        }

        if (cooldownService.isInCooldown()) {
            showToast('Cooldown Active', 'Please wait for the cooldown period to end', 'error');
            return;
        }

        const executeBtn = document.getElementById('executeBtn');
        const originalContent = executeBtn.innerHTML;

        // Show loading state
        executeBtn.disabled = true;
        executeBtn.innerHTML = `
            <div class="loading-spinner"></div>
            Executing...
        `;

        try {
            const response = await apiRequest('POST', '/api/execute', {
                number: targetNumber,
                method: method,
                userId: currentUser.id,
            });

            const data = await response.json();

            if (response.ok && data.success) {
                cooldownService.setLastSubmissionTime();
                showSuccessNotification();
                
                // Clear form
                document.getElementById('targetNumber').value = '';
                document.getElementById('method').value = '';
                
                showToast('Success', 'Command executed successfully');
                
                // Update cooldown display
                updateCooldownDisplay();
            } else {
                throw new Error(data.message || 'Execution failed');
            }
        } catch (error) {
            showToast('Execution Failed', error.message || 'An error occurred', 'error');
        } finally {
            executeBtn.disabled = false;
            executeBtn.innerHTML = originalContent;
        }
    });
}

function initCooldownTimer() {
    updateCooldownDisplay();
    
    // Update cooldown status every second
    cooldownInterval = setInterval(updateCooldownDisplay, 1000);
}

function updateCooldownDisplay() {
    const cooldownCard = document.getElementById('cooldownCard');
    const cooldownTimer = document.getElementById('cooldownTimer');
    const executeBtn = document.getElementById('executeBtn');

    const isInCooldown = cooldownService.isInCooldown();
    const remaining = cooldownService.getRemainingCooldownTime();

    if (cooldownCard && cooldownTimer && executeBtn) {
        if (isInCooldown) {
            cooldownCard.style.display = 'block';
            cooldownTimer.textContent = 
                `${remaining.minutes.toString().padStart(2, '0')}:${remaining.seconds.toString().padStart(2, '0')}`;
            executeBtn.disabled = true;
        } else {
            cooldownCard.style.display = 'none';
            executeBtn.disabled = false;
        }
    }
}

function initLogoutButtons() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutAccountBtn = document.getElementById('logoutAccountBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', authService.logout);
    }

    if (logoutAccountBtn) {
        logoutAccountBtn.addEventListener('click', authService.logout);
    }
}

// Initialize the appropriate page
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index.html') {
        initLoginPage();
    } else if (path === '/dashboard' || path === '/dashboard.html') {
        initDashboardPage();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
    }
});