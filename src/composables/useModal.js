import { useUiStore } from '../stores/uiStore';

/**
 * 提供一个简单的接口来显示不同类型的模态框。
 * @returns {{alert: Function, confirm: Function, prompt: Function}}
 */
export function useModal() {
    const uiStore = useUiStore();

    const alert = (options) => {
        if (typeof options === 'string') {
            options = { title: '提示', message: options };
        }
        return uiStore.showModal({ ...options, type: 'alert' });
    };

    const confirm = (options) => {
        if (typeof options === 'string') {
            options = { title: '确认', message: options };
        }
        return uiStore.showModal({ ...options, type: 'confirm' });
    };

    const prompt = (options) => {
        if (typeof options === 'string') {
            options = { title: '输入', message: options };
        }
        return uiStore.showModal({ ...options, type: 'prompt' });
    };

    return { alert, confirm, prompt };
}