chrome.commands.onCommand.addListener((command) => {
    if (command === "copy_last_response") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

            const tabId = tabs[0].id;

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["turndown.js", "turndown-plugin-gfm.js"], // Loads the Turndown library first
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    function: copyHtmlAsMarkdown,
                });
            });

            // if (tabs[0]) {
            //     chrome.scripting.executeScript({
            //         target: { tabId: tabs[0].id },
            //         function: copyLastResponse
            //     });
            // }
        });
    }
});

function copyHtmlAsMarkdown() {
    function showVisualFeedback() {
        const notification = document.createElement('div');
        notification.textContent = 'Copied the last message!';
        notification.id = 'gemini-copy-feedback';

        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '25px';
        notification.style.width = '300px'; /* Set the width separately */
        notification.style.height = '28px'; /* Set the width separately */
        notification.style.transform = 'translateX(0%)';
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = 'white';
        notification.style.padding = '10px';
        notification.style.borderRadius = '5px';
        notification.style.fontFamily = 'sans-serif';
        notification.style.fontWeight = 'bold';
        notification.style.fontSize = '16px';
        notification.style.textAlign = 'left';
        notification.style.alignContent = 'center';
        notification.style.zIndex = '2147483647';
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease-in-out';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = 1;
        }, 10);

        setTimeout(() => {
            notification.style.opacity = 0;
            setTimeout(() => notification.remove(), 500);
        }, 1500);
    }

    try {
        // Select all elements with the message-content class.
        const allMessages = document.getElementsByTagName('message-content');
        // const allMessages = document.querySelectorAll('.markdown');

        // Check if any messages were found.
        if (allMessages.length > 0) {
            // Get the very last message in the list.
            const lastResponse = allMessages[allMessages.length - 1];

            const turndownService = new TurndownService();

             // 2. GFM 플러그인 사용 선언 (테이블 변환을 위해 필수)
            turndownService.use(turndownPluginGfm.gfm);

            turndownService.addRule('codeBlock', {
                filter: ['pre'],
                replacement: function (content, node) {
                    const code = node.querySelector('code');
                    if (code) {
                        let language = '';

                        // Find the parent container of the code block.
                        const parentContainer = node.closest('.formatted-code-block-internal-container');

                        // Look for the sibling div with the language name.
                        if (parentContainer) {
                            const languageDiv = parentContainer.previousElementSibling;
                            if (languageDiv && languageDiv.classList.contains('code-block-decoration')) {
                                language = languageDiv.textContent.trim().toLowerCase();
                            }
                        }

                        return '\n```' + language + '\n' + code.textContent + '\n```\n';
                    }
                    // Fallback for pre tags without a code tag
                    return '\n```\n' + node.textContent + '\n```\n';
                }
                // function (content, node) {
                //     const code = node.querySelector('code');
                //     if (code) {
                //         // Return the raw text content wrapped in a Markdown code fence
                //         return '\n```\n' + code.textContent + '\n```\n';
                //     }
                //     // If there's no <code> tag inside, just return the content
                //     return '\n```\n' + node.textContent + '\n```\n';
                // }
            });
            const markdown = turndownService.turndown(lastResponse.innerHTML);

            navigator.clipboard.writeText(markdown)
                .then(() => {
                    console.log('Markdown copied successfully!');
                    showVisualFeedback();
                })
                .catch(err => {
                    console.error('Failed to copy Markdown:', err);
                });
        } else {
            console.warn('Could not find any messages.');
        }
    } catch (err) {
        console.error('An error occurred:', err);
    }
}




