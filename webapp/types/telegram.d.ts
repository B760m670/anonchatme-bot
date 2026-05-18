export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: { user?: { id: number; first_name?: string } };
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
      };
    };
  }
}
