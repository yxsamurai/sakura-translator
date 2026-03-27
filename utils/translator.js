/**
 * Sakura Translator - Translation API Layer
 * Handles all translation requests via the background service worker.
 */

const SakuraTranslator = (() => {
  /**
   * Translate text by sending a message to the background service worker
   * @param {string} text - Text to translate
   * @param {'word' | 'sentence'} type - Detection type
   * @param {'en' | 'zh' | 'mixed'} lang - Detected language
   * @returns {Promise<object>} Translation result
   */
  async function translate(text, type, lang) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'translate', text, type, lang },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        }
      );
    });
  }

  return { translate };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SakuraTranslator;
}
