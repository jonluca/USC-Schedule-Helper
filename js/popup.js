$(() => {
    options = loadOptions();

    if (options.extensionEnabled) {
        $("#chkExtensionDisabled").prop('checked', options.extensionEnabled);
    }

    if (options.showCalendar) {
        $("#chkConflicts").prop('checked', options.showCalendar);
    }

    if (options.showConflicts) {
        $("#chkCalendar").prop('checked', options.showConflicts);
    }
    $('input').parent().on('gumby.onChange', function () {
        changeOption(this);
    });
    $('input:checked').trigger('gumby.check');

});


function changeOption(elem) {
    switch (elem.htmlFor) {
        case "chkExtensionDisabled":
            options.extensionEnabled = (elem.className.indexOf('checked') !== -1);
            break;
        case "chkCalendar":
            options.showCalendar = (elem.className.indexOf('checked') !== -1);
            break;
        case "chkConflicts":
            options.showConflicts = (elem.className.indexOf('checked') !== -1);
            break;
    }
    console.log(options);
    saveOptions();
}


function saveOptions() {
    localStorage.options = JSON.stringify(options);
    sendOptions(options);
}
