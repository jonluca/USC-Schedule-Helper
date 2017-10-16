// Load options from local storage
// Return default values if none exist
function loadOptions() {
    var options;
    if (localStorage.options == null) {
        localStorage.options = '{}';
    }
    options = JSON.parse(localStorage.options);

    options.extensionEnabled = options.hasOwnProperty('extensionEnabled') ? options.extensionEnabled : true;
    options.showCalendar = options.hasOwnProperty('showCalendar') ? options.showCalendar : true;
    options.showConflicts = options.hasOwnProperty('showConflicts') ? options.showConflicts : true;

    localStorage.options = JSON.stringify(options);

    return options;
}

// Send options to all tabs and extension pages
function sendOptions(options) {
    var request = {action: 'optionsChanged', 'options': options};

    // Send options to all tabs
    chrome.windows.getAll(null, function (windows) {
        for (var i = 0; i < windows.length; i++) {
            chrome.tabs.getAllInWindow(windows[i].id, function (tabs) {
                for (var j = 0; j < tabs.length; j++) {
                    chrome.tabs.sendMessage(tabs[j].id, request);
                }
            });
        }
    });

    // Send options to other extension pages
    chrome.runtime.sendMessage(request);
}
