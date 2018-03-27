function scheduler_save(e) {
  kRefresh();
}

function scheduler_remove(e) {
  const scheduler = $("#scheduler").data("kendoScheduler");
  kRefresh();
}

function scheduler_cancel(e) {
  e.preventDefault();
}

function scheduler_moveE(e) {
  if ((e.event.Scheduled == "YN") || (e.event.Scheduled == "YY") || (e.event.Scheduled == "NY") || (e.event.Scheduled == "NN") || (e.event.Scheduled == "YN*") || (e.event.Scheduled == "YY*") || (e.event.Scheduled == "NY*") || (e.event.Scheduled == "NN*")) {
    setTimeout(function () {
    }, 0);
    e.preventDefault();
  }
  if ((e.event.Scheduled == "Block") || (e.event.Scheduled == "Block*")) {
    kRefresh();
  }
}

function kRefresh() {
  $("#scheduler").data("kendoScheduler").dataSource.read();
}

function load() {
  let today = new Date();
  let yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  $("btn").click(function () {

    setTimeout(function () {
      $("#scheduler").data("kendoScheduler").dataSource.read();
    }, 400);
  });

  jQuery("#scheduler").kendoScheduler({
    "height": "600px",
    "footer": false,
    "majorTick": 60,
    "date": new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0),
    "startTime": new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 7, 0, 0, 0),
    "endTime": new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 0, 0, 0),
    "workDayStart": new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0, 0),
    "workDayEnd": new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 0, 0, 0),
    "editable": {
      "template": `<div class="k-edit-label">
            <label for="Title">Label</label>
        </div>
        <div data-container-for="title" class="k-edit-field">
            <input class="k-textbox" data-bind="value:title" name="Title" type="text" required="required" />
        </div>

        <div class="k-edit-label">
            <label for="Start">Start</label>
        </div>
        <div data-container-for="start" class="k-edit-field">
            <input name="start" required="required" style="z-index: inherit;" type="datetime"
                   data-bind="value:start,invisible:isAllDay"
                   data-format="h:mm tt"
                   data-role="timepicker" />
            <span data-bind="text: startTimezone"></span>
            <span data-for="start" class="k-invalid-msg"></span>
        </div>

        <div class="k-edit-label">
            <label for="End">End</label>
        </div>
        <div data-container-for="end" class="k-edit-field">

            <input name="end" required="required" style="z-index: inherit;" type="datetime"
                   data-bind="value:end,invisible:isAllDay"
                   data-format="h:mm tt"
                   data-role="timepicker" />

            <span data-bind="text: endTimezone"></span>
            <span data-for="end" class="k-invalid-msg"></span>
        </div>`,
      "confirmation": "\u003cdiv style=\u0027text-align:left;padding-left:5px;\u0027\u003eThis Calendar tool allows you to plan your semester schedule and is meant to be a visual aid only. Adding or removing courses from this page will not affect your course enrollment. You will be able to register for courses from the myCourseBin or Checkout tab.\u003c/div\u003e",
      "editRecurringMode": "dialog"
    },
    "allDaySlot": false,
    "timezone": "America/Los_Angeles",
    "resources": [{
      "dataSource": [{
        "Text": "",
        "Value": "YN",
        "Color": "#ffcc00"
      }, {
        "Text": "",
        "Value": "YY",
        "Color": "#3ca70f"
      }, {
        "Text": "",
        "Value": "NY",
        "Color": "#3ca70f"
      }, {
        "Text": "",
        "Value": "NN",
        "Color": "#ff0000"
      }, {
        "Text": "",
        "Value": "YN*",
        "Color": "#ff0000"
      }, {
        "Text": "",
        "Value": "YY*",
        "Color": "#ff0000"
      }, {
        "Text": "",
        "Value": "NY*",
        "Color": "#ff0000"
      }, {
        "Text": "",
        "Value": "NN*",
        "Color": "#ff0000"
      }, {
        "Text": "",
        "Value": "Block",
        "Color": "#6a6a6a"
      }, {
        "Text": "",
        "Value": "Block*",
        "Color": "#ff0000"
      }],
      "field": "Scheduled",
      "dataTextField": "Text",
      "dataValueField": "Value",
      "dataColorField": "Color"
    }],
    "views": [{
      "type": "week",
      "footer": false,
      "minorTickCount": 1 // display one time slot per major tick
    }],
    "dataSource": {
      "type": (function () {
        return 'aspnetmvc-ajax';
      })(),
      "transport": {
        "read": {"url": "/Scheduler/Read"},
        "prefix": "",
        "update": {"url": "/Scheduler/Update"},
        "stringifyDates": true
      },
      "schema": {
        "data": "Data",
        "total": "Total",
        "errors": "Errors",
        "model": {
          "id": "TaskID",
          "fields": {
            "TaskID": {"type": "number"},
            "USCID": {"type": "string"},
            "TERM": {"type": "string"},
            "Scheduled": {"type": "string"},
            "Registered": {"type": "string"},
            "title": {
              "from": "Title",
              "type": "string"
            },
            "description": {
              "from": "Description",
              "type": "string"
            },
            "start": {
              "from": "Start",
              "type": "date"
            },
            "startTimezone": {
              "from": "StartTimezone",
              "type": "string"
            },
            "end": {
              "from": "End",
              "type": "date"
            },
            "endTimezone": {
              "from": "EndTimezone",
              "type": "string"
            },
            "recurrenceRule": {
              "from": "RecurrenceRule",
              "type": "string"
            },
            "RecurrenceID": {
              "type": "number",
              "defaultValue": null
            },
            "recurrenceException": {
              "from": "RecurrenceException",
              "type": "string"
            },
            "isAllDay": {
              "from": "IsAllDay",
              "type": "boolean"
            },
            "": {"type": "boolean"}
          }
        }
      },
      "data": {
        "Data": [],
        "Total": 0,
        "AggregateResults": null
      }
    }
  });
}

function check() {
  if (window.kendo) {
    load();
  } else {
    setTimeout(() => {
      check();
    }, 500);
  }
}

check();

function toggleCal() {
  //your code
  kRefresh();
  $(".k-today").removeClass('k-today');
  $("#scheduler").toggle();
}

document.body.onkeyup = function (e) {
  if (e.keyCode == 18) {
    e.preventDefault();
    toggleCal();
  } else if (e.keyCode == 27) {
    e.preventDefault();
    $("#popupCalendar").hide();
  }
};
