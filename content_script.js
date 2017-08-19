let professor_ratings = {};

$(() => {
    //Pages URL
    const currentURL = window.location.href;
    if (currentURL.includes("webreg")) {
        //Insert "Export to Calendar" button in nav bar
        insertExportButton();
    }
    //This loads the JSON of all the professors, rating, and unique ID. Only way I've found to get it, unfortunately, is through a HTTPRequest
    //Typically loads in ~40ms, so not a huge issue, I just wish there was a more efficient way of doing it
    const xhr = new XMLHttpRequest;
    xhr.open("GET", chrome.runtime.getURL("data/only_ratings.json"));
    xhr.onreadystatechange = function() {
        if (this.readyState === 4) {
            professor_ratings = JSON.parse(xhr.responseText);
            //If we are on webreg or if we're on classes.usc.edu
            if (currentURL.includes("webreg") && !currentURL.includes("/myCourseBin")) {
                //Appending to body makes the stylesheet async
                $('body').append(`<link rel="stylesheet" href="${chrome.runtime.getURL("data/sweetalert.css")}" type="text/css" />`);
                getCurrentSchedule();
                parseWebReg();
            } else {
                /*
                This is for courses.usc.edu, not web registration. Original version of the extension only worked
                here, then I realized it's useless and would be better suited for webreg
                */
                parseCoursePage(professor_ratings);
            }
        }
    };
    xhr.send();
});

//Version check for USC Schedule Helper
const version = chrome.runtime.getManifest().version;
$.ajax({
    method: 'GET',
    url: "https://jonlu.ca/soc_api/version",
    type: 'text',
    success(data, textStatus, jqXHR) {
        chrome.storage.sync.get('outdated_version', items => {
            //If there is a new version AND they haven't been notified before
            if (data > version && items['outdated_version'] !== version) {
                //Tell them to update their extension
                errorModal("USC Schedule Helper is outdated! Please update now. If chrome does not update automatically, you may follow <a href=\"http://lifehacker.com/5805239/how-to-manually-update-your-chrome-extensions\">this guide</a>");
                //Save outdated version locally so you don't show the same error constantly
                chrome.storage.sync.set({
                    'outdated_version': version
                }, () => {
                    console.log(`Saved out of date warning for ${version}`);
                });
            }
        });
    }
});

//Total spots is all lecture and lecture-lab spots (sum of 2nd # in "# of #"), available is first
let total_spots = 0;
let available_spots = 0;

//This is for sections (such as BIO) which have classes that are labs only. Its the running total of ALL "# of #", but only displayed if only_lab is true
let hidden_total_spots = 0;
let hidden_available_spots = 0;

//This is for when a class is closed - it'll let you know how many spots are open based on discussion
let discussion_total_spots = 0;
let discussion_available_spots = 0;

/*Initialize only_lab to true - will get set to false if type of class is ever anything but Lab
 We are usually only interested in Lecture and Lecture-Lab, but some classes *only* have Labs - these are still interesting
 to Bio kids and whatnot. So we'll save all of them, and only display either the Lecture-ish ones or, if it's all Bio, then display totals
 */
let only_lab = true;
//Checks whether all lecture sections are closed
let all_closed = false;
let has_lecture = false;
let has_discussion = false;

let current_closed = false;

//Url template for each professor
const url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
//Contains a span HTML element, which is just included to insert a blank column cell in each row, to preserve spacing
const empty_span = '<span class=\"instr_alt1 empty_rating col-xs-12 col-sm-12 col-md-1 col-lg-1\"><span \
class=\"hidden-lg hidden-md visible-xs-* visible-sm-* table-headers-xsmall\">Prof. Rating: </span></span>';

//An array that will contain the schedule that they are currently registered in
const current_schedule = [];

function getCurrentSchedule() {
    //Pulls schedule from myCourseBin
    $.ajax({
        method: 'GET',
        url: "https://webreg.usc.edu/myCourseBin",
        type: 'text',
        success(data, textStatus, jqXHR) {
            parseCurrentSchedule(data);
        }
    });
}

//Iterates over every section in myCourseBin
function parseCurrentSchedule(html) {
    const parsedHTML = $(html);
    const sections = $(parsedHTML).find("[id^=section_]");
    for (let i = 0; i < sections.length; i++) {
        $(sections[i]).find("[class=schUnschRmv]").each(function() {
            const text = $(this).find(".actionbar > a")[0].innerText;
            //If they currently have it scheduled on their calendar
            if ($(this).css('display') === 'block' && text === "Unschedule") {
                parseValidSectionSchedule($(this).parents("[class^=section_crsbin]")[0]);
            }
        });
    }
}

//If the section it is currently parsing conflicts with a class in current_schedule
function addConflictOverlay(row) {
    $(row).css('background-color', 'rgba(255, 134, 47, 0.37)');
    let add_to_cb = $(row).find(".addtomycb");
    if (add_to_cb.length !== 0) {
        add_to_cb = add_to_cb[0];
        $(add_to_cb).attr('value', 'Conflict - Overlap');
        $(add_to_cb).attr('title', 'This class overlaps with your current schedule!');
        $(add_to_cb).addClass("warning");
    }
}

//If the section from myCourseBin is valid, add it to current_schedule
function parseValidSectionSchedule(sectionDomElement) {
    let hours = $(sectionDomElement).find("[class^=hours]")[0].innerText;
    hours = hours.replace("Time: ", '');

    let days = $(sectionDomElement).find("[class^=days]")[0].innerText;
    days = days.replace("Days: ", '');
    days = splitDays(days);

    hours = hours.split("-");

    let section_id = $(sectionDomElement).find("[class^=id_alt]")[1].innerText;
    section_id = section_id.replace("Section: ", '');

    const time = {
        "day": days,
        "time": hours,
        "section": section_id
    };
    current_schedule.push(time);
    //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
    $(".crs-accordion-content-area").each(function() {
        const sections = $(this).find(".section_alt1, .section_alt0");
        sections.each(function() {
            //Get hours for current section
            let section_hours = $(this).find("[class^=hours]")[0].innerText;
            section_hours = section_hours.replace("Time: ", '');
            section_hours = section_hours.split("-");

            //Get days for class for current section
            let section_days = $(this).find("[class^=days]")[0].innerText;
            section_days = section_days.replace("Days: ", '');
            section_days = splitDays(section_days);

            //Get section name to compare if you already have that class
            let section_name = $(this).find("[class^=id]")[0].innerText;
            section_name = section_name.replace("Section: ", '');

            let should_break = false;

            /*Three nested for loops... Wow
            Kinda horrifying... but it works
            The saved schedule for classes currently in your course bin is current_schedule
            It iterates over current_schedule, then it iterates over every day in current schedule
            current schedule { day: ["M", "T", "Th"], time: ["08:00pm","11:00pm"], section: "33333"}
            Then it iterates over the current section (the specific class type per class, like discussion, lecture, etc)
            jQuery row object... I parsed section_days above, which would be like ["M", "T"]

            I need to filter it to only iterate over the intersection of the current_schedule day and the current class
            day. Other than that, though, I can't see a more efficient solution.

            This will ideally not loop that many times, though - at most 5*5*(4)ish, if they're registered for 4 classes,
            and all 4 classes having MTWTHF classes. This is not likely though - on average, it'll loop 4*2*3.

            Performance trace tells us we only spend ~0.5 seconds on this function, so optimization is not currently needed
            */
            for (const current_class of current_schedule) {
                if (should_break || section_name === current_class.section) {
                    break;
                }
                for (let j = 0; j < current_class.day.length; j++) {
                    if (should_break) {
                        break;
                    }
                    for (let k = 0; k < section_days.length; k++) {
                        //Class already registered/scheduled
                        const range = moment.range(moment(current_class.time[0], "hh:mma").day(current_class.day[j]),
                            moment(current_class.time[1], "hh:mma").day(current_class.day[j]));

                        const range2 = moment.range(moment(section_hours[0], "hh:mma").day(section_days[k]),
                            moment(section_hours[1], "hh:mma").day(section_days[k]));

                        if (range.overlaps(range2) && section_name !== current_class.section) {
                            should_break = true;
                            addConflictOverlay(this);
                        }
                    }
                }
            }
        });
    });

    $(".warning").hover(function() {
        $(this).attr('value', 'Add Anyway');
    }, function() {
        $(this).attr('value', 'Warning - Overlaps');
    });
}


function splitDays(days) {
    //Split Thursday first because otherwise it'll get split on Tuesday
    let split_days = days.replace("Th", "D");
    split_days = split_days.split('');
    for (let i = 0; i < split_days.length; i++) {
        switch (split_days[i]) {
            case "M":
                split_days[i] = "Monday";
                break;
            case "T":
                split_days[i] = "Tuesday";
                break;
            case "W":
                split_days[i] = "Wednesday";
                break;
            case "D":
                split_days[i] = "Thursday";
                break;
            case "F":
                split_days[i] = "Friday";
                break;
        }

    }
    return split_days;
}

function insertExportButton() {
    const navbar = $("ul.nav");
    $(navbar).append("<li><a class=\"exportCal\" href=\"https://my.usc.edu/ical/?term=20173\">Export To Calendar</a></li>");
    const cals = $(".exportCal");
    $(cals[1]).remove();
}

function addPostRequests() {
    $(".notify").each(function() {
        const form = $(this)[0].form;
        $(this).attr('value', 'Notify Me');
        $(this).unbind();
        $(this).attr('type', 'button');
        $(this).unbind('mouseenter mouseleave');
        const id = $(form).find("#sectionid");
        const courseid = id.val();
        $(this).click(() => {
            swal({
                title: 'Notify Me!',
                html: '<label> Email: </label> <input id="email" class="swal2-input">' +
                    '<label> Phone number (optional, for text notifications only)</label><input id="phone" class="swal2-input">',
                preConfirm() {
                    return new Promise(resolve => {
                        resolve([
                            $('#email').val(),
                            $('#phone').val()
                        ]
                        );
                    });
                },
                onOpen() {
                    $('#email').focus();
                },
                showCancelButton: true
            }).then(result => {
                let email = result[0];
                if (email) {
                    email = email.trim();
                }
                let phone = result[1];
                let department = $(form).find("#department")[0];
                department = $(department).attr("value");
                //If they got to this page by clicking on a specific course on myCourseBin, department won't be included in the form, not sure why
                //We do a hacky way by getting it from courseid
                if (department === "") {
                    let course = $(form).find("#courseid")[0];
                    course = $(course).attr("value");
                    course = course.split("-");
                    department = course[0];
                }
                if (phone === undefined) {
                    phone = "";
                }
                if (department === "" || department === undefined) {
                    errorModal(`Department in post request was null. Please contact jdecaro@usc.edu with a screenshot of this error!
Course: ${courseid}`);
                    return;
                }
                if (email !== null && email !== "ttrojan@usc.edu" && validateEmail(email) && department !== "") {
                    sendPostRequest(email, courseid, department, phone);
                } else {
                    errorModal(`Error with email or department!`);
                }

            }).catch(swal.noop);
        });

    });
}

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function sendPostRequest(email, courseid, department, phone) {
    $.ajax({
        method: 'POST',
        url: "https://jonluca.me/soc_api/notify",
        type: 'json',
        data: {
            email,
            courseid,
            department,
            phone
        },
        error(err) {
            console.log(err);
            if (err.status === 501) {
                errorModal("Error saving data! Please contact jdecaro@usc.edu with the class you are trying to register for.");
            } else if (err.status === 400) {
                errorModal("Invalid email!");
            } else {
                errorModal("An unknown error occurred! Please contact jdecaro@usc.edu with the class you are trying to register for.");
            }
        },
        success(data, textStatus, jqXHR) {
            if (textStatus === "success" && jqXHR.status === 200) {
                swal(
                    'Success!',
                    "Sent verification email - please verify your email to begin receiving notifications! <br> \
                    <strong> It's probably in your spam folder!</strong> <br> \
                    Please note this service is not guaranteed to work, and is still in beta. <br> \
                    If you have any questions, please contact jdecaro@usc.edu",
                    'success'
                );
            }
            //If they've already verified their emails, the server returns 201
            //Don't show the message saying an email was sent
            if (textStatus === "success" && jqXHR.status === 201) {
                swal(
                    'Success!',
                    "Please note this service is not guaranteed to work, and is still in beta. <br> \
                    If you have any questions, please contact jdecaro@usc.edu",
                    'success'
                );
            }
        }
    });
}

//Helper function to show pretty error messages
function errorModal(message) {
    swal(
        'Error!',
        message,
        'error'
    );
}

//This extension adds a new column, thus squeezing a lot of the elements
//The following function renames the button from "Add to myCourseBin" to "Add" to preserve space
function changeAddToCourseBinButton(row) {
    let add_to_cb = $(row).find(".addtomycb");
    if (add_to_cb.length !== 0) {
        add_to_cb = add_to_cb[0];
        $(add_to_cb).attr('value', 'Add');
    }
}

//Each row (which corresponds to a single lecture/lab/discussion time) needs to be parsed for times and spots available
function parseRegistrationNumbers(row) {
    //Find registration numbers for this row, formatted like "# of #". Hidden content also prepends it with Registered: so that must be cut out
    const registration_numbers_element = $(row).find(".regSeats_alt1, .regSeats_alt0");
    let registration_numbers;
    //Cut out hidden text before it
    //If class has reg details
    if (registration_numbers_element.length !== 0) {

        registration_numbers = registration_numbers_element[0].textContent.replace("Registered: ", "");

        //create array using "of" as delimiter
        registration_numbers = registration_numbers.split("of");
        if (registration_numbers.length !== 2) {
            current_closed = true;
            if (registration_numbers[0] !== null && registration_numbers[0].trim() === "Closed" && !has_lecture) {
                all_closed = true;
            }
            addNotifyMe(row);
            if (!$(row).hasClass("blank_rating")) {
                $(row).addClass("blank_rating");
                const location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
                $(location_of_insert).after(empty_span);
            }
        } else {
            addRegistrationNumbers(row, registration_numbers[0].trim(), registration_numbers[1].trim());
        }

    }
}

//Any course that is full will get a Notify Me button, which allows users to type in their information and be notified if the class opens up again
function addNotifyMe(row) {
    let addToCourseBinButton = $(row).find(".addtomycb");
    if (addToCourseBinButton.length !== 0) {
        $(addToCourseBinButton[0]).after('<input name="submit" value="Notify Me" class="btn btn-default addtomycb col-xs-12 notify" type="button">');
    }
    ///If the class is already in their coursebin (doesn't mean they've registered for it, though - this fixes the edge case that a lot of people have, in which
    //they have a course in their coursebin and are just waiting for a spot to open up)
    const alreadyInCourseBin = $(row).find(".alrdyinmycb");
    if (alreadyInCourseBin.length !== 0) {
        $(alreadyInCourseBin).replaceWith('<input name="submit" value="Notify Me" class="btn btn-default addtomycb col-xs-12" type="button">');
        let addToCourseBinAlready = $(row).find(".addtomycb");
        addToCourseBinAlready = addToCourseBinAlready[0];
        $(addToCourseBinAlready).attr('value', 'Notify Me');
        $(addToCourseBinAlready).removeAttr('type');
        $(addToCourseBinAlready).addClass("notify");
    }
}

// TODO: Fix this function, as it does too many things that are unrelated
function addRegistrationNumbers(row, enrolled, total) {
    //Gets each of ("# of #")
    //TODO: This utilizes global variables :( Sorry future person debugging this, I'll try to do a refactor before I leave USC
    current_enrolled = parseInt(enrolled);
    total_available = parseInt(total);
    //Checks class type - we are only interested in Lecture and Lecture-Lab
    const class_type_element = $(row).find('.type_alt1, .type_alt0');
    let class_type;
    if (class_type_element.length !== 0) {
        class_type = class_type_element[0].textContent;
        parseClassType(row, class_type);
    }

}

// Parses each row for what type of class it is, and whether there are still spots
function parseClassType(row, class_type) {
    //If it's not a lab or quiz
    if (class_type === "Type: Lecture" || class_type === "Type: Lecture-Lab" || class_type === "Type: Lecture-Discussion") {
        //It's not a lab, so only_lab is false
        only_lab = false;
        has_lecture = true;
        total_spots += total_available;
        available_spots += (total_available - current_enrolled);
        all_closed = false;
        // If the class is closed, insert the Notify Me button
        if (available_spots === 0) {
            addNotifyMe(row);
        }
    } else if (class_type === "Type: Lab") {
        hidden_total_spots += total_available;
        hidden_available_spots += (total_available - current_enrolled);
    } else if (class_type === "Type: Discussion") {
        only_lab = false;
        has_discussion = true;
        discussion_total_spots += total_available;
        discussion_available_spots += (total_available - current_enrolled);
    } else {
        //If not Lab or Lecture/lecture-lab then set the flag to false
        only_lab = false;
    }
}

function insertBlankRatingCell(row) {
    //blank rating is if you can not find the professor in the json - we still need something in that cell
    //Looking back it might be better if I add the cell in before hand no matter what, and then only change it's inner html if it's a valid professor...
    //TODO refactor for next semester I suppose
    if (!$(row).hasClass("blank_rating")) {
        $(row).addClass("blank_rating");
        const location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
        $(location_of_insert).after(empty_span);
    }
}

function insertProfessorRating(row, professor_info) {
    const url = url_template + professor_info.id;
    //To prevent reinserting, or if there are multiple professors, we insert an anchor with a rating class
    //if there already is one then we know it's another professor
    if ($(row).find('.rating').length !== 0) {
        $(row).find('.rating').after(`, <a href=${url}>${professor_info.rating}</a>`);
    } else {
        $(row).addClass("blank_rating");
        //long string but needs to be exactly formatted
        const location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
        //actual contents of rating
        const rating_anchor = `<a class="rating" href=${url} target="_blank">${professor_info.rating}</a>`;
        //long string just to include new
        $(location_of_insert).after(`<span class="hours_alt1 text-center col-xs-12 col-sm-12 col-md-1 col-lg-1"><span class="hidden-lg hidden-md                                 visible-xs-* visible-sm-* table-headers-xsmall">Prof. Rating: </span>${rating_anchor}</span>`);
        /* Very specific edge case - if you have two professors and you could not find the first, it'll insert an empty cell. However, if you can
             find the second you still want his score to be visible, so we need to remove the previously inserted blank one */
        if ($(row).find(".empty_rating").length !== 0) {
            $(row).find(".empty_rating")[0].remove();
        }
    }
}

function parseRows(rows) {
    $(rows).each(function() {
        //rename Add to myCourseBin button so that it fits/looks nice
        changeAddToCourseBinButton(this);

        parseRegistrationNumbers(this);

        //Retrieve Instructor cell from row
        const instructor_name_element = $(this).find(".instr_alt1, .instr_alt0");
        if (instructor_name_element.length === 0) {
            //I don't think this code actually ever runs, as USC creates blank cells with that class if it's empty, but better safe than sorry here.
            //If in the future they change it this'll prevent it from looking misaligned
            insertBlankRatingCell(this);
            //jQuery way of saying continue;
            return true;
        }
        //get all professor names in a hacky way
        const instructor_names = instructor_name_element[0].innerHTML.split("span>");
        //split on line breaks
        const instructor_name = instructor_names[1].split("<br>");
        //if there are multiple instructors
        for (const name of instructor_name) {
            //single instructor name, comma delimited
            parseProfessor(name, this);
        }

    });
}

function parseProfessor(instructor, row) {
    if (instructor.trim() === "" && !$(row).hasClass("blank_rating")) {
        $(row).addClass("blank_rating");
        const location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
        $(location_of_insert).after(empty_span);
    }
    let actual_name = instructor.split(", ");
    //generate actual name
    actual_name = `${actual_name[1]} ${actual_name[0]}`;

    //If instructor name in json
    if (actual_name in professor_ratings) {
        insertProfessorRating(row, professor_ratings[actual_name]);
    } else {
        insertBlankRatingCell(row);
    }
}

function insertProfRatingHeader(header) {
    const days = $(header).find(".instr_alt1, .instr_alt0")[0];
    $(days).after("<span class=\"instr_alt1 col-md-1 col-lg-1\"><b>Prof. Rating</b></span>");
}

// Resets global variables to 0. Ideally I'd refactor this to not have any globs, but the project started small and just grew
function reinitializeVariablesPerClass() {
    //reinit to 0
    total_spots = 0;
    available_spots = 0;

    //keeps track of all counts in case it's an all-lab scenario
    hidden_total_spots = 0;
    hidden_available_spots = 0;

    discussion_total_spots = 0;
    discussion_available_spots = 0;

    only_lab = true;
    //Checks whether all lecture sections are closed
    all_closed = false;
    //If it has ANY lecture sections
    has_lecture = false;

    has_discussion = false;

    //Is the current class closed for registration?
    current_closed = false;
}

function insertTotalSpots(element) {
    const name_element = $(element).prev();
    const name = $(name_element).find('.course-title-indent');
    let spotsRemainingString = `<span class="crsTitl spots_remaining"> - ${available_spots}`;
    if (available_spots === 1) {
        spotsRemainingString += " remaining spot" + "</span>";
    } else {
        spotsRemainingString += " remaining spots" + "</span>";
    }
    name.append(spotsRemainingString);
    //Let's make the background red if no spots remaining
    if (available_spots === 0) {
        $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
    }
}

function insertClosedRegistration(element) {
    const name_element = $(element).prev();
    const name = $(name_element).find('.course-title-indent');
    if (has_discussion) {
        name.append(`<span class="crsTitl spots_remaining"> - closed registration ( ${discussion_available_spots} spots remaining)</span>`);

    } else {
        name.append("<span class=\"crsTitl spots_remaining\">" + " - closed registration</span>");

    }
    //Let's make the background red if no spots remaining
    $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
}

function insertOnlyLabNumbers(element) {
    const name_element = $(element).prev();

    const name = $(name_element).find('.course-title-indent');
    name.append(`<span class="crsTitl spots_remaining"> - ${hidden_available_spots} remaining lab spots</span>`);

    if (hidden_available_spots === 0) {
        $(name).css("background-color", "rgba(240, 65, 36, 0.45)");
    }
}


function insertClassNumbers(element) {
    //Normal insert for remaining spots
    if (total_spots !== 0 && isNumber(total_spots)) {
        insertTotalSpots(element);
    }

    //If it's closed
    if (all_closed && !has_lecture) {
        insertClosedRegistration(element);
    }

    //if there were only labs in this class, show it
    if (only_lab && hidden_total_spots !== 0 && isNumber(hidden_total_spots)) {
        insertOnlyLabNumbers(element);
    }
}

function parseClass(classes) {
    $(classes).each(function() {
        //set global variables to 0 (counts, class closed, class type, etc)
        reinitializeVariablesPerClass();

        //Insert Prof Rating column at top of each class view
        const header = $(this).find(".section_head_alt1, .section_alt0");
        insertProfRatingHeader(header);

        //Iterate over every section in row. To get alternating colors, USC uses alt0 and alt1, so we must search for both
        const sections = $(this).find(".section_alt1, .section_alt0");
        parseRows(sections);
        //If total spots is a number and it's not 0, insert

        insertClassNumbers(this);

    });

}

function changeCSSColumnWidth() {
    //Sets CSS of page to display everything correctly
    $(".rm_alt1").css({
        "width": "4%"
    });
    $(".btnAddToMyCourseBin_alt1").css({
        "width": "12%",
        "float": "right"

    });
    $(".rm_alt0").css({
        "width": "4%"
    });
    $(".btnAddToMyCourseBin_alt0").css({
        "width": "12%",
        "float": "right"
    });
    $(".session_alt1").css({
        "width": "4%"
    });
    $(".session_alt0").css({
        "width": "4%"
    });
}

function parseWebReg() {

    //Because we insert a new column, we need to change the CSS around to make it look right
    changeCSSColumnWidth();

    //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
    const course_individual_class = $(".crs-accordion-content-area");

    //Parses each class found previously
    parseClass(course_individual_class);
    addPostRequests();

}

//Credit to http://stackoverflow.com/questions/8525899/how-to-check-if-a-javascript-number-is-a-real-valid-number
//Checks if a number is valid
function isNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n);
}

function parseCoursePage(professor_ratings) {
    //Get all courses
    const courses = $(".course-info");

    let total_spots = 0;
    let available_spots = 0;
    const url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
    //Iterate over courses on page
    for (let i = 0; i < courses.length; i++) {
        total_spots = 0;
        available_spots = 0;
        //Get table with jQuery selector
        const table = $(courses[i]).find("> .course-details > table.sections");

        //Get rows, iterate over each one
        $(table[0]).find("> tbody > tr").each(function() {
            if ($(this).hasClass("headers")) {
                //create new column
                $(this).find('.instructor').after('<th>Prof. Rating</th>');
                //jQuery's version of continue
                return true;
            }
            //find Type column
            let type = $(this).find("td.type");
            if (type.length !== 0) {
                type = type[0].textContent;
            } else {
                return true;
            }

            //Get registration numbers
            const registration_numbers = $(this).find("td.registered")[0].textContent.split(" of ");
            const current_enrolled = parseInt(registration_numbers[0]);
            const total_available = parseInt(registration_numbers[1]);

            //If it's not a lab or quiz
            if (type === "Lecture" || type === "Lecture-Lab") {
                total_spots += total_available;
                available_spots += (total_available - current_enrolled);
            }

            const professor = $(this).find("td.instructor")[0];
            //Professor names are separated by commas, so this handles the case that multiple profs teach a section
            const professor_name = professor.textContent.split(",");
            for (let i = 0; i < professor_name.length; i++) {
                split_prof = professor_name[i];
                //Names are formatted "First Last" so no reordering is necessary
                //However, some names are "First Middle Middle2 Last", and we only want "First Last" as that is the format of our json
                let actual_name = split_prof.split(" ");
                actual_name = `${actual_name[0]} ${actual_name[actual_name.length - 1]}`;

                //If its in JSON
                if (actual_name in professor_ratings) {
                    //generate RMP URL
                    const url = url_template + professor_ratings[actual_name].id;
                    //If we've never inserted before, insert. Otherwise insert with a comma before it for good formatting
                    if ($(this).find('.rating').length === 0) {
                        $(this).find('td.instructor').after(`<td class="rating"><a href=${url} target="_blank">${professor_ratings[actual_name].rating}</a></td>`);
                    } else {
                        $(this).find('.rating').append(`, <a href=${url}>${professor_ratings[actual_name].rating}</a>`);
                    }
                } else {
                    //If not in JSON, we need an empty space to make table format correctly
                    if ($(this).find('.rating').length === 0) {
                        $(this).find('td.instructor').after('<td class="rating"> </td>');
                    } else {
                        $(this).find('.rating').append(' ');
                    }
                }
            }
        });

        //insert remaining spots in main
        const title = $(courses[i]).find("> .course-id > h3 > a");
        if (total_spots !== 0 && isNumber(total_spots)) {
            let availableString = ` - ${available_spots} remaining spot`;
            if (available_spots > 1) {
                availableString += "s";
            }
            if (available_spots === 0) {
                availableString += "s";
                const background = $(courses[i]).find("> .course-id");
                $(background).css("background-color", "rgba(240, 65, 36, 0.45)");
            }
            title.append(availableString);

        }
    }
}