// --- Configuration ---
        const dotValues = [ // 各ドットに割り当てる値 (2の累乗)
            1, 2, 4, 8, 16,
            32, 64, 128, 256, 512,
            1024, 2048, 4096, 8192, 16384,
            32768, 65536, 131072, 262144, 524288,
            1048576, 2097152, 4194304, 8388608, 16777216
        ];

        const letterPatterns = { // 文字認識のためのパターン定義（合計値→文字のマッピング）
            17836036: 'A', 28611899: 'B', 32539711: 'C', 1224985: 'D', 32567296: 'E',
            1113151: 'F', 33092671: 'G', 18415153: 'H', 32641183: 'I', 7475359: 'J',
            17990833: 'K', 32539681: 'L', 18405233: 'M', 18667121: 'N', 33080895: 'O',
            1113663: 'P', 33347135: 'Q', 18153023: 'R', 33061951: 'S', 4329631: 'T',
            33080881: 'U', 4204561: 'V', 18732593: 'W', 18157905: 'X', 4329809: 'Y',
            32575775: 'Z',
        };

        // 数字ドットの位置を特定 (index -> digit)
        const numericPositions = {
            0: '1', 2: '2', 4: '3', 10: '4', 12: '5', 14: '6', 20: '7', 22: '8', 24: '9'
        };

        // ワードドットのマッピング (value -> word)
        const dotWordMapping = {
            128: '+', 131072: '-', 2048: '*', 8192: '/'
        };

        // --- DOM Elements ---
        const elements = {
            dotGrid: document.getElementById('dot-grid'),
            specialRow: document.getElementById('special-row'),
            lineCanvas: document.getElementById('line-canvas'),
            input: document.getElementById('textInput'),
            d2dArea: document.getElementById('d2d-input-area'),
        };
        const lineCtx = elements.lineCanvas.getContext('2d');

        // --- Gesture State ---
        const drawState = {
            isActive: false,
            detectedDots: new Set(), // Set of dot elements
            totalValue: 0,
            startX: 0,
            startY: 0,
            lastStrokeTime: 0,
            multiStrokeTimeout: 700, // ms timeout between strokes for recognition
            longPressTimer: null,
            longPressDuration: 500, // ms for long press
            isLongPress: false, // Flag to indicate if long press occurred
            currentTouchId: null, // Track touch identifier
        };

        // --- Initialization ---
        function initKeypad() {
            elements.dotGrid.innerHTML = ''; // Clear existing grid
            elements.specialRow.innerHTML = ''; // Clear existing special row

            // Create 5x5 Dot Grid
            for (let row = 0; row < 5; row++) {
                const rowContainer = document.createElement('div');
                rowContainer.className = 'dot-row';
                for (let col = 0; col < 5; col++) {
                    const index = row * 5 + col;
                    const value = dotValues[index];
                    const dot = document.createElement('div');
                    dot.className = 'dot';
                    dot.dataset.index = index;
                    dot.dataset.value = value;

                    const digit = numericPositions[index];
                    const word = dotWordMapping[value];

                    if (digit) {
                        dot.classList.add('numeric');
                        dot.textContent = digit;
                        dot.dataset.digit = digit; // Store digit for long press
                    } else if (word) {
                        dot.classList.add('word-dot');
                        dot.textContent = word;
                        dot.dataset.word = word; // Store word for long press
                    } else {
                        // Optional: Display value or index on other dots for debugging
                        // dot.textContent = index;
                    }
                    rowContainer.appendChild(dot);
                }
                elements.dotGrid.appendChild(rowContainer);
            }

            // Create Special Buttons Row
            // * Button (Delete)
            const deleteButton = document.createElement('div');
            deleteButton.className = 'special-button delete';
            deleteButton.textContent = '*';
            deleteButton.dataset.action = 'delete';
            deleteButton.title = '削除'; // Tooltip
            elements.specialRow.appendChild(deleteButton);

            // 0 Button (Long press for 0)
            const zeroButton = document.createElement('div');
            zeroButton.className = 'dot numeric'; // Reuse dot style
            zeroButton.textContent = '0';
            zeroButton.dataset.digit = '0';
            elements.specialRow.appendChild(zeroButton);

            // # Button (Space)
            const spaceButton = document.createElement('div');
            spaceButton.className = 'special-button space';
            spaceButton.textContent = '#';
            spaceButton.dataset.action = 'space';
            spaceButton.title = '空白'; // Tooltip
            elements.specialRow.appendChild(spaceButton);

            // Resize canvas initially and on window resize
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            // Setup Event Listeners
            setupDotEventListeners();
            setupSpecialButtonListeners();
            setupGestureListeners(); // Listeners for swipe movement
        }

        // --- Canvas Resizing ---
        function resizeCanvas() {
            // Make canvas cover the d2d input area precisely
            const rect = elements.d2dArea.getBoundingClientRect();
            const style = window.getComputedStyle(elements.d2dArea);
            const paddingLeft = parseFloat(style.paddingLeft);
            const paddingTop = parseFloat(style.paddingTop);

             elements.lineCanvas.width = elements.d2dArea.clientWidth - paddingLeft * 2;
             elements.lineCanvas.height = elements.d2dArea.clientHeight - paddingTop * 2;

             elements.lineCanvas.style.left = `${paddingLeft}px`;
             elements.lineCanvas.style.top = `${paddingTop}px`;
             updateCanvas(); // Redraw lines after resize
        }

        // --- Event Listener Setup ---
        function setupDotEventListeners() {
            const dots = document.querySelectorAll('#dot-grid .dot');
            dots.forEach(dot => {
                dot.addEventListener('pointerdown', (e) => handlePointerDown(e, dot), { passive: false });
            });
        }

        function setupSpecialButtonListeners() {
            const deleteBtn = elements.specialRow.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => { handleDeleteAction(); });
            }
            const spaceBtn = elements.specialRow.querySelector('[data-action="space"]');
            if (spaceBtn) {
                spaceBtn.addEventListener('click', () => { insertAtCursor(' '); });
            }
            const zeroBtn = elements.specialRow.querySelector('[data-digit="0"]');
            if (zeroBtn) {
                zeroBtn.addEventListener('pointerdown', (e) => handlePointerDown(e, zeroBtn), { passive: false });
            }
        }

        function setupGestureListeners() {
            document.addEventListener('pointermove', handlePointerMove, { passive: false });
            document.addEventListener('pointerup', handlePointerUp, { passive: false });
            document.addEventListener('pointercancel', handlePointerUp, { passive: false });
        }

        // --- Event Handlers ---
        function handlePointerDown(e, element) {
            e.preventDefault();
            if (element.hasPointerCapture(e.pointerId)) { return; }
            try {
                element.setPointerCapture(e.pointerId);
                element.dataset.pointerId = e.pointerId;
            } catch (err) { console.error("Error setting pointer capture:", err); }

            drawState.isLongPress = false;
            drawState.currentTouchId = e.pointerId;
            const digit = element.dataset.digit;
            const word = element.dataset.word;

            if (digit || word) {
                clearTimeout(drawState.longPressTimer);
                drawState.longPressTimer = setTimeout(() => {
                    if (drawState.isActive && drawState.detectedDots.size > 1) return;
                    insertAtCursor(digit || word);
                    drawState.isLongPress = true;
                    resetDrawState();
                    clearCanvas();
                }, drawState.longPressDuration);
            }

            if (element.closest('#dot-grid')) {
                 startDrawing(element, e.clientX, e.clientY);
            }
        }

        function handlePointerMove(e) {
            if (!drawState.isActive || e.pointerId !== drawState.currentTouchId) return;
            e.preventDefault();
            if (drawState.longPressTimer) {
                clearTimeout(drawState.longPressTimer);
                drawState.longPressTimer = null;
            }
            detectDot(e.clientX, e.clientY);
            updateCanvas();
        }

        function handlePointerUp(e) {
            if (e.pointerId !== drawState.currentTouchId) return;
            e.preventDefault();
            const capturingElement = document.querySelector(`[data-pointer-id="${e.pointerId}"]`);
             if (capturingElement && capturingElement.hasPointerCapture(e.pointerId)) {
                 try {
                    capturingElement.releasePointerCapture(e.pointerId);
                    delete capturingElement.dataset.pointerId;
                 } catch(err) { console.error("Error releasing pointer capture on up:", err); }
            }
            clearTimeout(drawState.longPressTimer);
            if (drawState.isActive && !drawState.isLongPress) {
                endDrawing();
            } else if (drawState.isLongPress) {
                 resetDrawState();
                 clearCanvas();
            }
            drawState.currentTouchId = null;
        }

        function handleDeleteAction() {
            const textarea = elements.input;
            const cursorPos = textarea.selectionStart;
            if (cursorPos > 0) {
                const textBefore = textarea.value.substring(0, cursorPos - 1);
                const textAfter = textarea.value.substring(cursorPos);
                textarea.value = textBefore + textAfter;
                textarea.selectionStart = textarea.selectionEnd = cursorPos - 1;
            }
            textarea.focus();
        }

        // --- Gesture Logic Functions ---
        function startDrawing(dotElement, startX, startY) {
            if (!dotElement || !dotElement.classList.contains('dot') || !dotElement.closest('#dot-grid')) return;
            const now = Date.now();
            if (!drawState.isActive || now - drawState.lastStrokeTime > drawState.multiStrokeTimeout) {
                resetDrawState(true);
            }
            drawState.isActive = true;
            drawState.startX = startX;
            drawState.startY = startY;
            addDetectedDot(dotElement);
            updateCanvas();
        }

       function detectDot(clientX, clientY) {
            const dots = document.querySelectorAll('#dot-grid .dot');
            dots.forEach(dot => {
                if (drawState.detectedDots.has(dot)) return;
                const rect = dot.getBoundingClientRect();
                if (clientX >= rect.left && clientX <= rect.right &&
                    clientY >= rect.top && clientY <= rect.bottom) {
                    addDetectedDot(dot);
                }
            });
        }

        function addDetectedDot(dotElement) {
            if (!dotElement || drawState.detectedDots.has(dotElement)) return;
            dotElement.classList.add('detected'); // Add visual feedback to all detected dots
            drawState.detectedDots.add(dotElement);
            const value = parseInt(dotElement.dataset.value, 10);
            if (!isNaN(value)) {
                drawState.totalValue += value;
            }
        }

         function endDrawing() {
            if (!drawState.isActive) return;
            const now = Date.now();
            drawState.lastStrokeTime = now;
            setTimeout(() => {
                const currentTime = Date.now();
                if (currentTime - drawState.lastStrokeTime >= drawState.multiStrokeTimeout - 50) {
                    if (drawState.detectedDots.size > 0 && drawState.totalValue > 0) {
                        const recognized = recognizeLetter(drawState.totalValue);
                        if (recognized) {
                            insertAtCursor(recognized);
                        }
                    }
                    resetDrawState();
                    clearCanvas();
                }
            }, drawState.multiStrokeTimeout);
        }

        function recognizeLetter(totalValue) {
            if (letterPatterns[totalValue]) {
                return letterPatterns[totalValue];
            }
            return null;
        }

         function resetDrawState(keepActive = false) {
            drawState.isActive = keepActive;
            drawState.detectedDots.forEach(dot => dot.classList.remove('detected'));
            drawState.detectedDots.clear();
            drawState.totalValue = 0;
            drawState.isLongPress = false;
             if (!keepActive) { drawState.lastStrokeTime = 0; }
             clearTimeout(drawState.longPressTimer);
             drawState.longPressTimer = null;
        }

        // --- Canvas Drawing Functions ---

        function updateCanvas() {
            const canvas = elements.lineCanvas;
            const ctx = lineCtx;
            const grid = elements.dotGrid;
            if (!grid || !canvas) return; // Ensure elements exist
            const gridRect = grid.getBoundingClientRect();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- MODIFIED: Only connect numeric dots ---
            const numericDotsToConnect = [];
            drawState.detectedDots.forEach(dot => {
                // Check if the dot is numeric
                if (dot.classList.contains('numeric')) {
                    numericDotsToConnect.push(dot);
                }
            });

            // Only draw if there are numeric dots to connect
            if (numericDotsToConnect.length < 1) return;

            ctx.beginPath();
            ctx.strokeStyle = '#ef4444'; // red-500
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            let isFirstNumeric = true;
            numericDotsToConnect.forEach(dot => {
                const dotRect = dot.getBoundingClientRect();
                // Calculate center relative to the dotGrid's top-left corner
                const x = (dotRect.left - gridRect.left) + (dotRect.width / 2);
                const y = (dotRect.top - gridRect.top) + (dotRect.height / 2);

                if (isFirstNumeric) {
                    ctx.moveTo(x, y);
                    isFirstNumeric = false;
                } else {
                    ctx.lineTo(x, y);
                }
            });

            // Stroke the path if lines were drawn (i.e., at least one numeric dot was processed)
            if (!isFirstNumeric) {
                 ctx.stroke();
            }
        }


        function clearCanvas() {
             if (lineCtx && elements.lineCanvas) {
                lineCtx.clearRect(0, 0, elements.lineCanvas.width, elements.lineCanvas.height);
             }
        }

        // --- Utility Functions ---
        function insertAtCursor(text) {
            const textarea = elements.input;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const textBefore = textarea.value.substring(0, start);
            const textAfter = textarea.value.substring(end);
            textarea.value = textBefore + text + textAfter;
            const newCursorPos = start + text.length;
            textarea.selectionStart = textarea.selectionEnd = newCursorPos;
            textarea.focus();
        }

        // --- Initial Setup ---
        window.onload = initKeypad;