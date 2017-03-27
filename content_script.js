$(document).ready(function() {
    //Get all courses
    var courses = $(".course-info");

    var total_spots = 0;
    var available_spots = 0;

    //Iterate over courses on page
    for (var i = 0; i < courses.length; i++) {
        total_spots = 0;
        available_spots = 0;
        //Get table with jQuery selector
        var table = $(courses[i]).find("> .course-details > table.sections");

        //Get rows, iterate over each one
        var rows = $(table[0]).find("> tbody > tr").each(function() {
            if ($(this).hasClass("headers")) {
                //jQuery's version of continue
                return true;
            }
            var type = $(this).find("td.type");
            if (type.length != 0) {
                type = type[0].textContent;
            } else {
                return true;
            }
            var registration_numbers = $(this).find("td.registered")[0].textContent.split(" of ");
            var current_enrolled = parseInt(registration_numbers[0]);
            var total_available = parseInt(registration_numbers[1]);

            //If it's not a lab or quiz
            if (type == "Lecture" || type == "Lecture-Lab") {
                total_spots += total_available;
                available_spots += (total_available - current_enrolled);
            }
        });

        var title = $(courses[i]).find("> .course-id > h3 > a");
        if (total_spots != 0) {
            title.append(" - " + available_spots + " remaining spots");
        }
    }
});