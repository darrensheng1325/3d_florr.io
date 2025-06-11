export class EventEmitter<T> {
    private listeners: { [event: string]: ((data: any) => void)[] } = {};

    on(event: string, callback: (data: any) => void): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event: string, data?: any): void {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
} 