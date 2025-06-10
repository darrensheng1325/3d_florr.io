export interface LoginOptions {
    onLogin: (accountId: string, username: string) => void;
    onCancel?: () => void;
}

export class LoginUI {
    private overlay: HTMLDivElement;
    private isVisible: boolean = false;
    private onLoginCallback: ((accountId: string, username: string) => void) | null = null;
    private onCancelCallback: (() => void) | null = null;

    constructor() {
        this.overlay = this.createLoginOverlay();
        document.body.appendChild(this.overlay);
    }

    private createLoginOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        const loginContainer = document.createElement('div');
        loginContainer.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            max-width: 400px;
            width: 90%;
            text-align: center;
            animation: slideIn 0.3s ease-out;
        `;

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .login-input {
                width: 100%;
                padding: 15px;
                margin: 10px 0;
                border: 2px solid #e1e5e9;
                border-radius: 12px;
                font-size: 16px;
                outline: none;
                transition: all 0.3s ease;
                box-sizing: border-box;
            }
            
            .login-input:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .login-button {
                width: 100%;
                padding: 15px;
                margin: 10px 0;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .login-button-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .login-button-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            .login-button-secondary {
                background: #f8f9fa;
                color: #6c757d;
                border: 2px solid #e9ecef;
            }
            
            .login-button-secondary:hover {
                background: #e9ecef;
                transform: translateY(-1px);
            }
            
            .login-divider {
                margin: 25px 0;
                position: relative;
                text-align: center;
            }
            
            .login-divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: #e1e5e9;
            }
            
            .login-divider span {
                background: rgba(255, 255, 255, 0.95);
                padding: 0 20px;
                color: #6c757d;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);

        // Title
        const title = document.createElement('h1');
        title.style.cssText = `
            margin: 0 0 30px 0;
            color: #2c3e50;
            font-size: 28px;
            font-weight: 700;
        `;
        title.textContent = '3D Florr.io';
        loginContainer.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('p');
        subtitle.style.cssText = `
            margin: 0 0 30px 0;
            color: #6c757d;
            font-size: 16px;
        `;
        subtitle.textContent = 'Enter your credentials to join the game';
        loginContainer.appendChild(subtitle);

        // Username input
        const usernameInput = document.createElement('input');
        usernameInput.className = 'login-input';
        usernameInput.type = 'text';
        usernameInput.placeholder = 'Enter your username';
        usernameInput.maxLength = 20;
        usernameInput.addEventListener('input', () => {
            // Remove special characters and limit length
            usernameInput.value = usernameInput.value.replace(/[^a-zA-Z0-9_\-]/g, '');
        });
        loginContainer.appendChild(usernameInput);

        // Password input (optional for future use)
        const passwordInput = document.createElement('input');
        passwordInput.className = 'login-input';
        passwordInput.type = 'password';
        passwordInput.placeholder = 'Enter your password (optional)';
        passwordInput.maxLength = 50;
        loginContainer.appendChild(passwordInput);

        // Login button
        const loginButton = document.createElement('button');
        loginButton.className = 'login-button login-button-primary';
        loginButton.textContent = 'Join Game';
        loginButton.addEventListener('click', () => {
            this.handleLogin(usernameInput.value.trim(), passwordInput.value);
        });
        loginContainer.appendChild(loginButton);

        // Divider
        const divider = document.createElement('div');
        divider.className = 'login-divider';
        divider.innerHTML = '<span>or</span>';
        loginContainer.appendChild(divider);

        // Guest button
        const guestButton = document.createElement('button');
        guestButton.className = 'login-button login-button-secondary';
        guestButton.textContent = 'Play as Guest';
        guestButton.addEventListener('click', () => {
            this.handleGuestLogin();
        });
        loginContainer.appendChild(guestButton);

        // Account info
        const accountInfo = document.createElement('div');
        accountInfo.style.cssText = `
            margin-top: 25px;
            padding: 15px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 10px;
            border-left: 4px solid #667eea;
        `;
        accountInfo.innerHTML = `
            <div style="color: #2c3e50; font-weight: 600; margin-bottom: 5px;">Account Information</div>
            <div style="color: #6c757d; font-size: 14px; line-height: 1.4;">
                Your progress, inventory, and statistics will be saved automatically.
                Accounts are identified by username - no email required.
            </div>
        `;
        loginContainer.appendChild(accountInfo);

        // Handle Enter key
        const handleEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.handleLogin(usernameInput.value.trim(), passwordInput.value);
            }
        };
        usernameInput.addEventListener('keydown', handleEnter);
        passwordInput.addEventListener('keydown', handleEnter);

        overlay.appendChild(loginContainer);
        return overlay;
    }

    private handleLogin(username: string, password: string): void {
        if (!username) {
            this.showError('Please enter a username');
            return;
        }

        if (username.length < 3) {
            this.showError('Username must be at least 3 characters long');
            return;
        }

        if (username.length > 20) {
            this.showError('Username must be 20 characters or less');
            return;
        }

        // Generate account ID from username (similar to current system but more robust)
        const accountId = this.generateAccountId(username);
        
        // Store the username for display purposes
        localStorage.setItem('florr_username', username);
        localStorage.setItem('florr_account_id', accountId);

        if (this.onLoginCallback) {
            this.onLoginCallback(accountId, username);
        }

        this.hide();
    }

    private handleGuestLogin(): void {
        // Generate a temporary guest account
        const guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const guestName = 'Guest_' + Math.random().toString(36).substr(2, 6);
        
        // Don't store guest accounts in localStorage
        if (this.onLoginCallback) {
            this.onLoginCallback(guestId, guestName);
        }

        this.hide();
    }

    private generateAccountId(username: string): string {
        // Create a more robust account ID generation
        const baseString = username.toLowerCase().replace(/[^a-z0-9]/g, '');
        let hash = 0;
        
        for (let i = 0; i < baseString.length; i++) {
            const char = baseString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Make it positive and add prefix
        return 'user_' + Math.abs(hash).toString();
    }

    private showError(message: string): void {
        // Remove any existing error
        const existingError = this.overlay.querySelector('.login-error');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'login-error';
        errorDiv.style.cssText = `
            background: #fee;
            color: #c33;
            padding: 10px;
            border-radius: 8px;
            margin: 15px 0;
            border: 1px solid #fcc;
            font-size: 14px;
        `;
        errorDiv.textContent = message;

        const container = this.overlay.querySelector('div');
        if (container) {
            const submitButton = container.querySelector('.login-button-primary');
            if (submitButton) {
                container.insertBefore(errorDiv, submitButton);
            }
        }

        // Remove error after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    public show(options: LoginOptions): void {
        this.onLoginCallback = options.onLogin;
        this.onCancelCallback = options.onCancel || null;
        this.overlay.style.display = 'flex';
        this.isVisible = true;

        // Focus on username input
        const usernameInput = this.overlay.querySelector('input[type="text"]') as HTMLInputElement;
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }
    }

    public hide(): void {
        this.overlay.style.display = 'none';
        this.isVisible = false;
        this.onLoginCallback = null;
        this.onCancelCallback = null;

        // Clear any errors
        const error = this.overlay.querySelector('.login-error');
        if (error) {
            error.remove();
        }
    }

    public isShowing(): boolean {
        return this.isVisible;
    }

    public destroy(): void {
        if (this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }

    // Static helper methods for account management
    public static getStoredUsername(): string | null {
        return localStorage.getItem('florr_username');
    }

    public static getStoredAccountId(): string | null {
        return localStorage.getItem('florr_account_id');
    }

    public static hasStoredAccount(): boolean {
        return !!(this.getStoredAccountId() && this.getStoredUsername());
    }

    public static clearStoredAccount(): void {
        localStorage.removeItem('florr_username');
        localStorage.removeItem('florr_account_id');
    }
} 