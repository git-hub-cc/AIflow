import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
    const modalState = ref({
        isVisible: false,
        title: '',
        message: '',
        type: 'alert', // 'alert', 'confirm', 'prompt'
        promptValue: '',
        resolve: null,
        reject: null,
    });

    // --- MODIFICATION START ---
    const resultModalState = ref({
        isVisible: false,
        resultData: null,
    });
    // --- MODIFICATION END ---


    /**
     * 显示模态框并返回一个 Promise，该 Promise 在用户交互后解析或拒绝。
     * @param {object} options - 模态框配置 { title, message, type, defaultValue }
     * @returns {Promise<any>}
     */
    function showModal(options) {
        return new Promise((resolve, reject) => {
            modalState.value = {
                isVisible: true,
                title: options.title || '通知',
                message: options.message || '',
                type: options.type || 'alert',
                promptValue: options.defaultValue || '',
                resolve,
                reject,
            };
        });
    }

    // --- MODIFICATION START ---
    /**
     * 显示执行结果模态框。
     * @param {object} data - 要在模态框中显示的结果数据。
     */
    function showResultModal(data) {
        resultModalState.value = {
            isVisible: true,
            resultData: data,
        };
    }

    /**
     * 隐藏执行结果模态框。
     */
    function hideResultModal() {
        resultModalState.value = {
            isVisible: false,
            resultData: null,
        };
    }
    // --- MODIFICATION END ---

    /**
     * 当用户点击确认按钮时调用。
     * @param {any} value - 对于 prompt 类型，这是输入的值；对于其他类型，通常是 true。
     */
    function handleConfirm(value) {
        if (modalState.value.resolve) {
            modalState.value.resolve(value);
        }
        resetModal();
    }

    /**
     * 当用户点击取消或关闭按钮时调用。
     */
    function handleCancel() {
        if (modalState.value.reject) {
            // 模拟原生 confirm(false) 和 prompt(null) 的行为
            modalState.value.reject(new Error('User cancelled the action.'));
        }
        resetModal();
    }

    /**
     * 重置模态框状态。
     */
    function resetModal() {
        modalState.value = {
            isVisible: false,
            title: '',
            message: '',
            type: 'alert',
            promptValue: '',
            resolve: null,
            reject: null,
        };
    }

    return {
        modalState,
        showModal,
        handleConfirm,
        handleCancel,
        // --- MODIFICATION START ---
        resultModalState,
        showResultModal,
        hideResultModal,
        // --- MODIFICATION END ---
    };
});