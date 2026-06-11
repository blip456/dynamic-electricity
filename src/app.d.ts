declare global {
    const __APP_VERSION__: string;
    const __APP_BUILD__: string;

    namespace App {
        interface Locals {}
        interface PageData {}
        interface PageState {}
        interface Platform {}
    }
}

export {};
