$(document).ready(function () {

    //This loads the JSON of all the professors, rating, and unique ID. Only way I've found to get it, unfortunately
    var xhr = new XMLHttpRequest;
    xhr.open("GET", chrome.runtime.getURL("data/only_ratings.json"));
    xhr.onreadystatechange = function () {
        if (this.readyState == 4) {
            professor_ratings = JSON.parse(xhr.responseText);
            var currentURL = window.location.href;
            //If we are on webreg or if we're on classes.usc.edu 
            if (currentURL.includes("webreg")) {
                getCurrentSchedule();
                parseWebReg(professor_ratings);
                //addPostRequests();
            } else {
                parseCoursePage(professor_ratings);
            }
        }
    };
    xhr.send();


});


//Total spots is all lecture and lecture-lab spots (sum of 2nd # in "# of #"), available is first
var total_spots = 0;
var available_spots = 0;

//This is for sections (such as BIO) which have classes that are labs only. Its the running total of ALL "# of #", but only displayed if only_lab is true
var hidden_total_spots = 0;
var hidden_available_spots = 0;

//Thsi is for when a class is closed - it'll let you know how many spots are open based on discussion
var discussion_total_spots = 0;
var discussion_available_spots = 0;

/*Initialize only_lab to true - will get set to false if type of class is ever anything but Lab
 We are usually only intereseted in Lecture and Lecture-Lab, but some classes *only* have Labs - these are still interesting
 to Bio kids and whatnot. So we'll save all of them, and only display either the Lecture-ish ones or, if it's all Bio, then display totals
 */
var only_lab = true;
//Checks whether all lecture sections are closed
var all_closed = false;
var has_lecture = false;
var has_discussion = false;

var current_closed = false;

//Url template for each professor
var url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
//Contains a span HTML element, which is just included to insert a blank column cell in each row, to preserve spacing
var empty_span = '<span class=\"instr_alt1 empty_rating col-xs-12 col-sm-12 col-md-1 col-lg-1\"><span \
class=\"hidden-lg hidden-md visible-xs-* visible-sm-* table-headers-xsmall\">Prof. Rating: </span></span>';

var current_schedule = [];

function getCurrentSchedule() {
    $.ajax({
        method: 'GET',
        url: "https://webreg.usc.edu/myCourseBin",
        type: 'text',
        success: function (data, textStatus, jqXHR) {
            parseCurrentSchedule(data);
        }
    });
}

function parseCurrentSchedule(html) {
    var parsedHTML = $(html);
    var sections = $(parsedHTML).find("[id^=section_]");
    for (var i = 0; i < sections.length; i++) {
        $(sections[i]).find("[class=schUnschRmv]").each(function () {
            if ($(this).css('display') == 'block') {
                parseValidSectionSchedule($(this).parents("[class^=section_crsbin]")[0]);
            }
        });
    }
}

function parseValidSectionSchedule(section) {
    var hours = $(section).find("[class^=hours]")[0].innerText;
    hours = hours.replace("Time: ", '');

    var days = $(section).find("[class^=days]")[0].innerText;
    days = days.replace("Days: ", '');
    days = splitDays(days);

    hours = hours.split("-");
    var time = {"day": days, "time": hours};
    current_schedule.push(time);
    //Gets main div
    var course_titles = $(".course-title-indent");
    //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
    var course_individual_class = $(".crs-accordion-content-area").each(function () {
        var sections = $(this).find(".section_alt1, .section_alt0");
        sections.each(function () {
            var section = this;
            var section_hours = $(this).find("[class^=hours]")[0].innerText;
            section_hours = section_hours.replace("Time: ", '');

            var section_days = $(section).find("[class^=days]")[0].innerText;
            section_days = section_days.replace("Days: ", '');
            section_days = splitDays(section_days);

            section_hours = section_hours.split("-");
            var should_break = false;
            //Three nested for loops... Wow
            for (var i = 0; i < current_schedule.length; i++) {
                if (should_break) {
                    break;
                }
                var current_class = current_schedule[i];
                for (var j = 0; j < current_class.day.length; j++) {
                    if (should_break) {
                        break;
                    }
                    for (var k = 0; k < section_days.length; k++) {
                        //Class already registered/scheduled
                        var range = moment.range(moment(current_class.time[0], "hh:mma").day(current_class.day[j]),
                            moment(current_class.time[1], "hh:mma").day(current_class.day[j]));

                        var range2 = moment.range(moment(section_hours[0], "hh:mma").day(section_days[k]),
                            moment(section_hours[1], "hh:mma").day(section_days[k]));

                        if (range.overlaps(range2)) {
                            should_break = true;
                            $(this).css('background-color', 'rgba(255, 134, 47, 0.37)');
                            var add_to_cb = $(section).find(".addtomycb");
                            if (add_to_cb.length != 0) {
                                add_to_cb = add_to_cb[0];
                                $(add_to_cb).attr('value', 'Conflict - Overlap');
                                $(add_to_cb).attr('title', 'This class overlaps with your current schedule!');
                                $(add_to_cb).addClass("warning");
                            }
                        }
                    }
                }
            }

        })
    })

    $(".warning").hover(
        function () {
            $(this).attr('value', 'Add Anyway');

        }, function () {
            $(this).attr('value', 'Warning - Overlaps');
        }
    );
}

function splitDays(days) {
    //Split Thursday first because otherwise it'll get split on Tuesday
    var split_days = days.replace("Th", "D");
    split_days = split_days.split('');
    for (var i = 0; i < split_days.length; i++) {
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
    var navbar = $("ul.nav");
    $(navbar).append("<li><a class=\"exportCal\" href=\"https://my.usc.edu/ical/?term=20173\">Export To Calendar</a></li>");
    var cals = $(".exportCal");
    $(cals[1]).remove();
}

function addPostRequests() {
    var notify_me = $(".notify").each(function () {
        $(this).unbind();
        $(this).attr('type', 'button');
        var form = $(this).parents('form');

        $(this).click(function () {
            var email = prompt("Please enter your email", "ttrojan@usc.edu");
            var courseid = $(this).attr("id");
            var department = $(form).find("#department")[0];
            department = $(department).attr("value");
            if (email != null && email != "ttrojan@usc.edu") {
                $.ajax({
                    method: 'POST',
                    url: "https://jonluca.me/soc_api/notify",
                    type: 'json',
                    data: {
                        email: email,
                        courseid: courseid,
                        department: department
                    },
                    success: function (data, textStatus, jqXHR) {
                        alert("Success! Check your email to confirm.");
                        console.log(data);
                    }
                });
            }
        });
    });
}

function changeAddToCourseBinButton(row) {
    var add_to_cb = $(row).find(".addtomycb");
    if (add_to_cb.length != 0) {
        add_to_cb = add_to_cb[0];
        $(add_to_cb).attr('value', 'Add');
    }
}

function parseRegistrationNumbers(row) {
    //Find registration numbers for this row, formatted like "# of #". Hidden content also prepends it with Registered: so that must be cut out
    var registration_numbers_element = $(row).find(".regSeats_alt1, .regSeats_alt0");
    var registration_numbers;
    //Cut out hidden text before it
    //If class has reg details
    if (registration_numbers_element.length != 0) {

        registration_numbers = registration_numbers_element[0].textContent.replace("Registered: ", "");

        //create array using "of" as delimiter
        registration_numbers = registration_numbers.split("of");
        if (registration_numbers.length != 2) {
            current_closed = true;
            if (registration_numbers[0] != null && registration_numbers[0].trim() == "Closed" && !has_lecture) {
                all_closed = true;
            }
            //addNotifyMe(row);
            if (!$(row).hasClass("blank_rating")) {
                $(row).addClass("blank_rating");
                var location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
                $(location_of_insert).after(empty_span);
            }
        } else {
            addRegistrationNumbers(row, registration_numbers[0].trim(), registration_numbers[1].trim());
        }

    }
}

function addNotifyMe(row) {
    var button_to_change = $(row).find(".addtomycb");
    if (button_to_change.length != 0) {
        button_to_change = button_to_change[0];
        $(button_to_change).attr('value', 'Notify Me');
        $(button_to_change).removeAttr('type');
        var actual_id = $("#sectionid").attr("value");
        $(button_to_change).attr('id', actual_id);
        $(button_to_change).addClass("notify");
    }
}

function addRegistrationNumbers(row, enrolled, total) {
    //Gets each of ("# of #")
    current_enrolled = parseInt(enrolled);
    total_available = parseInt(total);
    //Checks class type - we are only interested in Lecture and Lecture-Lab
    var class_type_element = $(row).find('.type_alt1, .type_alt0');
    var class_type;
    if (class_type_element.length != 0) {
        class_type = class_type_element[0].textContent;
        parseClassType(row, class_type);
    }

}

function parseClassType(row, class_type) {
    //If it's not a lab or quiz
    if (class_type == "Type: Lecture" || class_type == "Type: Lecture-Lab" || class_type == "Type: Lecture-Discussion") {
        //It's not a lab, so only_lab is false
        only_lab = false;
        has_lecture = true;
        total_spots += total_available;
        available_spots += (total_available - current_enrolled);
        all_closed = false;
        //change button to notify m
        if (available_spots == 0) {
            //addNotifyMe(row);
        }
    } else if (class_type == "Type: Lab") {
        hidden_total_spots += total_available;
        hidden_available_spots += (total_available - current_enrolled);
    } else if (class_type == "Type: Discussion") {
        only_lab = false;
        has_discussion = true;
        discussion_total_spots += total_available;
        discussion_available_spots += (total_available - current_enrolled);
    } else {
        //If not Lab or Lecture/lecture-lab then false
        only_lab = false;
    }
}

function insertBlankRatingCell(row) {
    //blank rating is if you can not find the professor in the json - we still need something in that cell
    //Looking back it might be better if I add the cell in before hand no matter what, and then only change it's inner html if it's a valid professor...
    //TODO refactor for next semester I suppose
    if (!$(row).hasClass("blank_rating")) {
        $(row).addClass("blank_rating");
        var location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
        $(location_of_insert).after(empty_span);
    }
}

function insertProfessorRating(row, professor_info) {
    var url = url_template + professor_info.id;
    //To prevent reinserting, or if there are multiple professors, we insert an anchor with a rating class
    //if there already is one then we know it's another professor
    if ($(row).find('.rating').length == 0) {
        $(row).addClass("blank_rating");
        //long string but needs to be exactly formatted
        var location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
        //actual contents of rating
        var rating_anchor = '<a class=\"rating\" href=' + url + " target=\"_blank\">" + professor_info.rating + '</a>';
        //long string just to include new 
        $(location_of_insert).after('<span class=\"hours_alt1 text-center col-xs-12 col-sm-12 col-md-1 col-lg-1\"><span class=\"hidden-lg hidden-md \
                                visible-xs-* visible-sm-* table-headers-xsmall\">Prof. Rating: </span>' + rating_anchor + '</span>');
        /* Very specific edge case - if you have two profoessors and you could not find the first, it'll insert an empty cell. However, if you can 
         find the second you still want his score to be visible, so we need to remove the previously inserted blank one */
        if ($(row).find(".empty_rating").length != 0) {
            $(row).find(".empty_rating")[0].remove();
        }
    } else {
        $(row).find('.rating').after(', <a href=' + url + ">" + professor_info.rating + '</a>');
    }
}

function parseRows(rows) {
    $(rows).each(function () {

        //rename Add to myCourseBin button so that it fits/looks nice
        changeAddToCourseBinButton(this);

        parseRegistrationNumbers(this);

        //Retrievie Instructor cell from row
        var instructor_name_element = $(this).find(".instr_alt1, .instr_alt0");
        if (instructor_name_element.length != 0) {
            //get all professor names in a hacky way
            var instructor_names = instructor_name_element[0].innerHTML.split("span>");
            //split on line breaks
            var instructor_name = instructor_names[1].split("<br>");
            var single_instructor;
            //if there are multiple instructors
            for (var i = 0; i < instructor_name.length; i++) {
                //single instructor name, comma delimeted
                parseProfessor(instructor_name[i], this);
            }
        } else {
            //I don't think this code actually ever runs, as USC creates blank cells with that class if it's empty, but better safe than sorry here. 
            //If in the future they change it this'll prevent it from looking misaligned
            insertBlankRatingCell(this);
            //jQuery way of saying continue;
            return true;
        }
    });
}

function parseProfessor(instructor, row) {
    if (instructor.trim() == "" && !$(row).hasClass("blank_rating")) {
        $(row).addClass("blank_rating");
        var location_of_insert = $(row).find('.instr_alt1, .instr_alt0')[0];
        $(location_of_insert).after(empty_span);
    }
    var actual_name = instructor.split(", ");
    //generate actual name
    actual_name = actual_name[1] + " " + actual_name[0];

    //If instructor name in json
    if (actual_name in professor_ratings) {
        insertProfessorRating(row, professor_ratings[actual_name]);
    } else {
        insertBlankRatingCell(row);
    }
}

function insertProfRatingHeader(header) {
    var days = $(header).find(".instr_alt1, .instr_alt0")[0];
    $(days).after("<span class=\"instr_alt1 col-md-1 col-lg-1\"><b>Prof. Rating</b></span>");
}

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
    var name_element = $(element).prev();
    var name = $(name_element).find('.course-title-indent');
    name.append("<span class=\"crsTitl spots_remaining\">" + " - " + available_spots + " remaining spots" + "</span>");
    //Let's make the background red if no spots remaining
    if (available_spots == 0) {
        $(name).css("background-color", "rgba(240, 65, 36, 0.75)");
    }
}

function insertClosedRegistration(element) {
    var name_element = $(element).prev();
    var name = $(name_element).find('.course-title-indent');
    if (has_discussion) {
        name.append("<span class=\"crsTitl spots_remaining\">" + " - closed registration ( " + discussion_available_spots + " spots remaing)</span>");

    } else {
        name.append("<span class=\"crsTitl spots_remaining\">" + " - closed registration</span>");

    }
    //Let's make the background red if no spots remaining
    $(name).css("background-color", "rgba(240, 65, 36, 0.75)");
}

function insertOnlyLabNumbers(element) {
    var name_element = $(element).prev();

    var name = $(name_element).find('.course-title-indent');
    name.append("<span class=\"crsTitl spots_remaining\">" + " - " + hidden_available_spots + " remaining lab spots" + "</span>");

    if (hidden_available_spots == 0) {
        $(name).css("background-color", "rgba(240, 65, 36, 0.75)");
    }
}


function insertClassNumbers(element) {
    //Normal insert for remaining spots
    if (total_spots != 0 && isNumber(total_spots)) {
        insertTotalSpots(element);
    }

    //If it's closed
    if (all_closed && !has_lecture) {
        insertClosedRegistration(element);
    }

    //if there were only labs in this class, show it
    if (only_lab && hidden_total_spots != 0 && isNumber(hidden_total_spots)) {
        insertOnlyLabNumbers(element);
    }
}

function parseClass(classes) {
    $(classes).each(function () {
        //set global variables to 0 (counts, class closed, class type, etc)
        reinitializeVariablesPerClass();

        //Insert Prof Rating column at top of each class view
        var header = $(this).find(".section_head_alt1");
        insertProfRatingHeader(header);

        //Iterate over every section in row. To get alternating colors, USC uses alt0 and alt1, so we must search for both
        var sections = $(this).find(".section_alt1, .section_alt0");
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

function parseWebReg(professor_ratings) {

    insertExportButton();
    //Because we insert a new column, we need to change the CSS around to make it look right
    changeCSSColumnWidth();


    //Gets main div
    var course_titles = $(".course-title-indent");
    //Iterate over every div. The layout of webreg is alternating divs for class name/code and then its content
    var course_individual_class = $(".crs-accordion-content-area");

    //Parses each class found previously
    parseClass(course_individual_class);
}

//Credit to http://stackoverflow.com/questions/8525899/how-to-check-if-a-javascript-number-is-a-real-valid-number
//Checks if a number is valid
function isNumber(n) {
    return typeof n == 'number' && !isNaN(n) && isFinite(n);
}

function parseCoursePage(professor_ratings) {
    //Get all courses
    var courses = $(".course-info");

    var total_spots = 0;
    var available_spots = 0;
    var url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
    //Iterate over courses on page
    for (var i = 0; i < courses.length; i++) {
        total_spots = 0;
        available_spots = 0;
        //Get table with jQuery selector
        var table = $(courses[i]).find("> .course-details > table.sections");

        //Get rows, iterate over each one
        var rows = $(table[0]).find("> tbody > tr").each(function () {
            if ($(this).hasClass("headers")) {
                //create new column 
                $(this).find('.instructor').after('<th>Prof. Rating</th>');
                //jQuery's version of continue
                return true;
            }
            //find Type column
            var type = $(this).find("td.type");
            if (type.length != 0) {
                type = type[0].textContent;
            } else {
                return true;
            }

            //Get registration numbers
            var registration_numbers = $(this).find("td.registered")[0].textContent.split(" of ");
            var current_enrolled = parseInt(registration_numbers[0]);
            var total_available = parseInt(registration_numbers[1]);

            //If it's not a lab or quiz
            if (type == "Lecture" || type == "Lecture-Lab") {
                total_spots += total_available;
                available_spots += (total_available - current_enrolled);
            }

            var professor = $(this).find("td.instructor")[0];
            //Professor names are separated by commas, so this handles the case that multiple profs teach a section
            var professor_name = professor.textContent.split(",");
            for (var i = 0; i < professor_name.length; i++) {
                split_prof = professor_name[i];
                //Names are formatted "First Last" so no reordering is necessary
                //However, some names are "First Middle Middle2 Last", and we only want "First Last" as that is the format of our json
                var actual_name = split_prof.split(" ");
                actual_name = actual_name[0] + " " + actual_name[actual_name.length - 1];

                //If its in JSON
                if (actual_name in professor_ratings) {
                    //generate RMP URL
                    var url = url_template + professor_ratings[actual_name].id;
                    //If we've never inserted before, insert. otherwsie insert with a comma before it for good formatting
                    if ($(this).find('.rating').length == 0) {
                        $(this).find('td.instructor').after('<td class="rating"><a href=' + url + " target=\"_blank\">" + professor_ratings[actual_name].rating + '</a></td>');
                    } else {
                        $(this).find('.rating').append(', <a href=' + url + ">" + professor_ratings[actual_name].rating + '</a>');
                    }
                } else {
                    //If not in JSON, we need an empty space to make table format correctly
                    if ($(this).find('.rating').length == 0) {
                        $(this).find('td.instructor').after('<td class="rating"> </td>');
                    } else {
                        $(this).find('.rating').append(' ');
                    }
                }
            }
        });

        //insert remaining spots in main 
        var title = $(courses[i]).find("> .course-id > h3 > a");
        if (total_spots != 0 && isNumber(total_spots)) {
            title.append(" - " + available_spots + " remaining spots");
            if (available_spots == 0) {
                var background = $(courses[i]).find("> .course-id");
                $(background).css("background-color", "rgba(240, 65, 36, 0.75)");

            }
        }
    }
}