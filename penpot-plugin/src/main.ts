import "./style.css";

// Auto-reconnect configuration
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;

// get the current theme from the URL
const searchParams = new URLSearchParams(window.location.search);
document.body.dataset.theme = searchParams.get("theme") ?? "light";

// Determine whether multi-user mode is enabled based on URL parameters
const isMultiUserMode = searchParams.get("multiUser") === "true";
console.log("Penpot MCP multi-user mode:", isMultiUserMode);

// WebSocket connection management
let ws: WebSocket | null = null;
const statusElement = document.getElementById("connection-status");
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isManualDisconnect = false;

/**
 * Updates the connection status display element.
 *
 * @param status - the base status text to display
 * @param isConnectedState - whether the connection is in a connected state (affects color)
 * @param message - optional additional message to append to the status
 */
function updateConnectionStatus(status: string, isConnectedState: boolean, message?: string): void {
    if (statusElement) {
        const displayText = message ? `${status}: ${message}` : status;
        statusElement.textContent = displayText;
        statusElement.style.color = isConnectedState ? "var(--accent-primary)" : "var(--error-700)";
    }
}

/**
 * Sends a task response back to the MCP server via WebSocket.
 *
 * @param response - The response containing task ID and result
 */
function sendTaskResponse(response: any): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
        console.log("Sent response to MCP server:", response);
    } else {
        console.error("WebSocket not connected, cannot send response");
    }
}

/**
 * Schedules an automatic reconnection attempt with exponential backoff.
 */
function scheduleReconnect(): void {
    if (isManualDisconnect) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        updateConnectionStatus("Max reconnect attempts reached", false);
        console.warn("Auto-reconnect: max attempts reached, giving up.");
        return;
    }
    reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
    const cappedDelay = Math.min(delay, 30000); // cap at 30s
    updateConnectionStatus(`Reconnecting in ${cappedDelay / 1000}s...`, false);
    console.log(`Auto-reconnect: attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${cappedDelay}ms`);

    reconnectTimer = setTimeout(() => {
        if (ws?.readyState !== WebSocket.OPEN && !isManualDisconnect) {
            connectToMcpServer();
        }
    }, cappedDelay);
}

/**
 * Stops any pending auto-reconnect attempts.
 */
function stopAutoReconnect(): void {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

/**
 * Disconnects the WebSocket and stops auto-reconnect.
 */
function disconnectFromMcpServer(): void {
    isManualDisconnect = true;
    stopAutoReconnect();
    if (ws) {
        ws.close();
        ws = null;
    }
    updateConnectionStatus("Disconnected", false);
}

/**
 * Establishes a WebSocket connection to the MCP server.
 */
function connectToMcpServer(): void {
    if (ws?.readyState === WebSocket.OPEN) {
        updateConnectionStatus("Already connected", true);
        return;
    }

    // If this is a manual reconnection, reset the flag
    isManualDisconnect = false;
    stopAutoReconnect();

    try {
        let wsUrl = PENPOT_MCP_WEBSOCKET_URL;
        if (isMultiUserMode) {
            // TODO obtain proper userToken from penpot
            const userToken = "dummyToken";
            wsUrl += `?userToken=${encodeURIComponent(userToken)}`;
        }
        ws = new WebSocket(wsUrl);
        updateConnectionStatus("Connecting...", false);

        ws.onopen = () => {
            reconnectAttempts = 0;
            isManualDisconnect = false;
            console.log("Connected to MCP server");
            updateConnectionStatus("Connected to MCP server", true);
        };

        ws.onmessage = (event) => {
            console.log("Received from MCP server:", event.data);
            try {
                const request = JSON.parse(event.data);
                // Forward the task request to the plugin for execution
                parent.postMessage(request, "*");
            } catch (error) {
                console.error("Failed to parse WebSocket message:", error);
            }
        };

        ws.onclose = (event: CloseEvent) => {
            console.log("Disconnected from MCP server");
            const message = event.reason || undefined;
            ws = null;
            // Only auto-reconnect if this was not a manual disconnect
            if (!isManualDisconnect) {
                scheduleReconnect();
            } else {
                updateConnectionStatus("Disconnected", false, message);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            // note: WebSocket error events typically don't contain detailed error messages
            updateConnectionStatus("Connection error", false);
        };
    } catch (error) {
        console.error("Failed to connect to MCP server:", error);
        const message = error instanceof Error ? error.message : undefined;
        updateConnectionStatus("Connection failed", false, message);
        // Schedule reconnect after connection failure too
        if (!isManualDisconnect) {
            scheduleReconnect();
        }
    }
}

document.querySelector("[data-handler='connect-mcp']")?.addEventListener("click", () => {
    isManualDisconnect = false;
    connectToMcpServer();
});

document.getElementById("disconnect-mcp")?.addEventListener("click", () => {
    disconnectFromMcpServer();
});

// Listen plugin.ts messages
window.addEventListener("message", (event) => {
    if (event.data.source === "penpot") {
        document.body.dataset.theme = event.data.theme;
    } else if (event.data.type === "task-response") {
        // Forward task response back to MCP server
        sendTaskResponse(event.data.response);
    }
});
