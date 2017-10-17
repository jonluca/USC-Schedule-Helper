var options;
$(() => {
    loadOptions(function (recOptions) {
        options = recOptions;
        $("#chkExtensionDisabled").prop('checked', options.extensionEnabled);
        $("#chkConflicts").prop('checked', options.showConflicts);
        $("#chkCalendar").prop('checked', options.showCalendar);
        $('input:checked').trigger('gumby.check');

        $('input').parent().on('gumby.onChange', function () {
            changeOption(this);
        });
    });
});

function changeOption(elem) {

    switch (elem.htmlFor) {
        case "chkExtensionDisabled":
            options.extensionEnabled = $('#chkExtensionDisabled')[0].checked;
            break;
        case "chkCalendar":
            options.showCalendar = $('#chkCalendar')[0].checked;
            break;
        case "chkConflicts":
            options.showConflicts = $('#chkConflicts')[0].checked;
            break;
    }

    console.log(options);
    saveOptions();
}


function saveOptions() {
    chrome.storage.sync.set({
        'options': options
    }, () => {
        sendOptions(options);
    });
}
