$(() => {
    options = loadOptions();

});

function i18n() {
    console.log("d")
    $('[data-i18n]').each(function (index, element) {
        var elem = $(element);
        elem.text(chrome.i18n.getMessage(elem.attr('data-i18n')));
    });
    $('[data-i18n-placeholder]').each(function (index, element) {
        var elem = $(element);
        elem.attr('placeholder', chrome.i18n.getMessage(elem.attr('data-i18n-placeholder')));
    });
    $('[data-i18n-tooltip]').each(function (index, element) {
        var elem = $(element);
        elem.attr('data-tooltip', chrome.i18n.getMessage(elem.attr('data-i18n-tooltip')));
    });
}

i18n();