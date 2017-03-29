
$(document).ready(function() {

    var xhr = new XMLHttpRequest;
    xhr.open("GET", chrome.runtime.getURL("data/only_ratings.json"));
    xhr.onreadystatechange = function() {
        if (this.readyState == 4) {
            professor_ratings = JSON.parse(xhr.responseText);
            var currentURL = window.location.href;
            if (currentURL.includes("webreg")) {
                parseWebReg(professor_ratings);
            } else {
                parseCoursePage(professor_ratings);
            }
        }
    };
    xhr.send();


});

var url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";
var empty_span = '<span class=\"instr_alt1 empty_rating col-xs-12 col-sm-12 col-md-1 col-lg-1\"><span class=\"hidden-lg hidden-md visible-xs-* visible-sm-* table-headers-xsmall\">Prof. Rating: </span></span>';


function parseWebReg(professor_ratings) {

    //Sets CSS of page to display everything correctly
    $(".rm_alt1").css({
        "width": "4%"
    });
    $(".btnAddToMyCourseBin_alt1").css({
        "width": "8%"
    });

    $(".rm_alt0").css({
        "width": "4%"
    });
    $(".btnAddToMyCourseBin_alt0").css({
        "width": "8%"
    });


    var total_spots = 0;
    var available_spots = 0;

    var hidden_total_spots = 0;
    var hidden_available_spots = 0;

    var course_titles = $(".course-title-indent");

    var course_individual_class = $(".crs-accordion-content-area").each(function() {
        var current_id = $(this).attr('id');

        total_spots = 0;
        available_spots = 0;

        hidden_total_spots = 0;
        hidden_available_spots = 0;

        //Insert Prof Rating column
        var header = $(this).find(".section_head_alt1");
        var days = $(header).find(".instr_alt1, .instr_alt0")[0];
        $(days).after("<span class=\"instr_alt1 col-md-1 col-lg-1\"><b>Prof. Rating</b></span>");

        //insert prof rating
        var only_lab = true;
        //Ever row
        var sections = $(this).find(".section_alt1, .section_alt0").each(function() {

            var add_to_cb = $(this).find(".addtomycb");
            if (add_to_cb.length != 0) {
                add_to_cb = add_to_cb[0];
                $(add_to_cb).attr('value', 'Add');
            }
            var registration_numbers_element = $(this).find(".regSeats_alt1, regSeats_alt0");
            var registration_numbers;
            if (registration_numbers_element.length != 0) {
                registration_numbers = registration_numbers_element[0].textContent.replace("Registered: ", "");

                registration_numbers = registration_numbers.split("of");
                //first number in # of #
                var current_enrolled = parseInt(registration_numbers[0].trim());
                var total_available = parseInt(registration_numbers[1].trim());

                //See if we want to count these elements
                var class_type_element = $(this).find('.type_alt1, .type_alt0');
                var class_type;
                if (class_type_element.length != 0) {
                    class_type = class_type_element[0].textContent;
                    //If it's not a lab or quiz
                    if (class_type == "Type: Lecture" || class_type == "Type: Lecture-Lab") {
                        only_lab = false;
                        total_spots += total_available;
                        available_spots += (total_available - current_enrolled);
                    } else if (class_type == "Type: Lab") {
                        hidden_total_spots += total_available;
                        hidden_available_spots += (total_available - current_enrolled);
                    } else {
                        only_lab = false;
                    }
                }
            }

            //check if instructor element exists, find it
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
                    single_instructor = instructor_name[i];
                    if (single_instructor.trim() == "" && !$(this).hasClass("blank_rating")) {
                        $(this).addClass("blank_rating");
                        var location_of_insert = $(this).find('.instr_alt1, .instr_alt0')[0];
                        $(location_of_insert).after(empty_span);
                    }
                    var actual_name = single_instructor.split(", ");
                    //generate actual name
                    actual_name = actual_name[1] + " " + actual_name[0];

                    //If instructor name in json
                    if (actual_name in professor_ratings) {
                        var url = url_template + professor_ratings[actual_name].id;

                        if ($(this).find('.rating').length == 0) {
                            $(this).addClass("blank_rating");
                            //long string but needs to be exactly formatted
                            var location_of_insert = $(this).find('.instr_alt1')[0];
                            $(location_of_insert).after('<span class=\"hours_alt1 text-center col-xs-12 col-sm-12 col-md-1 col-lg-1\"><span class=\"hidden-lg hidden-md visible-xs-* visible-sm-* table-headers-xsmall\">Prof. Rating: </span><a class=\"rating\" href=' + url + " target=\"_blank\">" + professor_ratings[actual_name].rating + '</a></span>');
                            if ($(this).find(".empty_rating").length != 0) {
                                $(this).find(".empty_rating")[0].remove();
                            }
                        } else {
                            $(this).find('.rating').append(', <a href=' + url + ">" + professor_ratings[actual_name].rating + '</a>');
                        }
                    } else {
                        if (!$(this).hasClass("blank_rating")) {
                            $(this).addClass("blank_rating");
                            var location_of_insert = $(this).find('.instr_alt1, .instr_alt0')[0];
                            $(location_of_insert).after(empty_span);
                        }
                    }
                //do nothing otherwise
                }


            } else {
                if (!$(this).hasClass("blank_rating")) {
                    $(this).addClass("blank_rating");
                    var location_of_insert = $(this).find('.instr_alt1, .instr_alt0')[0];
                    $(location_of_insert).after(empty_span);
                } //jQuery way of saying continue;
                return true;
            }
        });
        if (total_spots != 0 && isNumber(total_spots)) {
            var name_element = $(this).prev();
            var name = $(name_element).find('.course-title-indent');
            name.append("<span class=\"crsTitl spots_remaining\">" + " - " + available_spots + " remaining spots" + "</span>");
        }

        if (only_lab && hidden_total_spots != 0 && isNumber(hidden_total_spots)) {
            var name_element = $(this).prev();
            var name = $(name_element).find('.course-title-indent');
            name.append("<span class=\"crsTitl spots_remaining\">" + " - " + hidden_available_spots + " remaining lab spots" + "</span>");
        }

    });
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
        var rows = $(table[0]).find("> tbody > tr").each(function() {
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
            var professor_name = professor.textContent.split(",");
            for (var i = 0; i < professor_name.length; i++) {
                split_prof = professor_name[i];
                var actual_name = split_prof.split(" ");
                actual_name = actual_name[0] + " " + actual_name[actual_name.length - 1];
                if (actual_name in professor_ratings) {
                    var url = url_template + professor_ratings[actual_name].id;
                    if ($(this).find('.rating').length == 0) {
                        $(this).find('td.instructor').after('<td class="rating"><a href=' + url + " target=\"_blank\">" + professor_ratings[actual_name].rating + '</a></td>');
                    } else {
                        $(this).find('.rating').append(', <a href=' + url + ">" + professor_ratings[actual_name].rating + '</a>');
                    }
                } else {
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
        }
    }
}