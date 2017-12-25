//Global options variable
var options;

// Options and popup links
function onMessage(message, sender, sendResponse) {
    if (message.action === 'optionsChanged') {
        options = message.options;
    }
}

chrome.runtime.onMessage.addListener(onMessage);
$(() => {
    loadOptions(function (receivedOptions) {
        options = receivedOptions;
        if (receivedOptions.extensionEnabled) {
            // Get SweetAlert CSS
            $('body').append(`<link rel="stylesheet" href="${chrome.runtime.getURL("data/sweetalert.css")}" type="text/css" />`);
            startHelper();
        }
    });
});

function startHelper() {
    $("#sb-site > div.container.inner-container > div > div.col-xs-12.col-sm-12.col-md-12.col-lg-12.content-wrapper-courses > div.course-container-padding > div:nth-child(1)").click();
    console.log("start");
    //Pages URL
    const currentURL = window.location.href;
    if (currentURL.includes("webreg")) {
        //Insert "Export to Calendar" button in nav bar
        insertExportButton();
    }
    insertBlankProfessorCells();
    // For professor ratings
    $.ajax({
        method: 'GET',
        url: chrome.runtime.getURL("data/only_ratings.json"),
        type: 'json',
        success(data, textStatus, jqXHR) {
            professor_ratings = data;
        }
    });
    //If we are on webreg or if we're on classes.usc.edu
    if (currentURL.includes("webreg") && !currentURL.includes("/myCourseBin")) {
        //Appending to body makes the stylesheet async
        if (options.showConflicts) {
            getCurrentSchedule();
        }
        //parseWebReg();
        if (options.showCalendar) {
            getCalendarHTML();
        }
    }
    else {
        /*
        This is for courses.usc.edu, not web registration. Original version of the extension only worked
        here, then I realized it's useless and would be better suited for webreg
        */
        parseCoursePage(professor_ratings);
    }
}

function insertRatings() {
}

function insertBlankProfessorCells() {
//Contains a span HTML element, which is just included to insert a blank column cell in each row, to preserve spacing
    $("[class^=section_head_alt]").each(function () {
        $(this).find("[class^=instr]").after("<span class=\"instr_alt1 col-md-1 col-lg-1\"><b>Prof. Rating</b></span>");
    });

    $("[class^=section_alt]").each(function () {
        $(this).find("[class^=instr]").after("<span class=\"empty_rating col-md-1 col-lg-1\"></span>");
    });
}

function insertExportButton() {
    const navbar = $("ul.nav");
    $(navbar).append("<li><a class=\"exportCal\" href=\"https://my.usc.edu/ical/?term=20181\">Export To Calendar</a></li>");
    const cals = $(".exportCal");
    $(cals[1]).remove();
}

function getCurrentSchedule() {
    //Pulls schedule from myCourseBin
    $.ajax({
        method: 'POST',
        url: "https://webreg.usc.edu/Scheduler/Read",
        type: 'text',
        success(data, textStatus, jqXHR) {
            //parseSchedule(data);
        }
    });
}

function getCalendarHTML() {
    //Pulls schedule from myCourseBin
    $.ajax({
        method: 'GET',
        url: "https://webreg.usc.edu/myKCal",
        type: 'text',
        success(data, textStatus, jqXHR) {
            //insertCalendar(data);
        }
    });
}