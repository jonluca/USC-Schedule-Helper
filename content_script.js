$(document).ready(function() {
    //Get all courses
    var courses = $(".course-info");

    var total_spots = 0;
    var available_spots = 0;
    var professor_ratings;
    var url_template = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=";



    var xhr = new XMLHttpRequest;
    xhr.open("GET", chrome.runtime.getURL("data/only_ratings.json"));
    xhr.onreadystatechange = function() {
        if (this.readyState == 4) {
            professor_ratings = JSON.parse(xhr.responseText);
            start();
        }
    };
    xhr.send();

    function start() {
        //Iterate over courses on page
        for (var i = 0; i < courses.length; i++) {
            total_spots = 0;
            available_spots = 0;
            //Get table with jQuery selector
            var table = $(courses[i]).find("> .course-details > table.sections");

            //Get rows, iterate over each one
            var rows = $(table[0]).find("> tbody > tr").each(function() {
                if ($(this).hasClass("headers")) {
                    $(this).find('th').eq(6).after('<th>Prof. Rating</th>');
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

                var professor = $(this).find("td.instructor")[0];
                var professor_name = professor.textContent;
                if (professor_name in professor_ratings) {
                    var url = url_template + professor_ratings[professor_name].id;
                    $(this).find('td').eq(6).after('<td><a href=' + url + ">" + professor_ratings[professor_name].rating + '</a></td>');
                } else {
                    $(this).find('td').eq(6).after('<td> </td>');
                }

            });

            var title = $(courses[i]).find("> .course-id > h3 > a");
            if (total_spots != 0) {
                title.append(" - " + available_spots + " remaining spots");
            }
        }
    }
});