let options;
let count = 3;
$(() => {
    $('body').on('click', 'a', function() {
        chrome.tabs.create({
            url: $(this).attr('href')
        });
        return false;
    });
    loadOptions(function(recOptions) {
        options = recOptions;
        $("#chkExtensionDisabled").prop('checked', options.extensionEnabled);
        $("#chkConflicts").prop('checked', options.showConflicts);
        $("#chkCalendar").prop('checked', options.showCalendar);
        $("#chkUnits").prop('checked', options.showUnits);
        $('input:checked').trigger('gumby.check');

        $('input').parent().on('gumby.onChange', function() {
            changeOption(this);
        });

        //                             ooMMMMMMMooo
        //                       oMMMMMMMMMMMMMMMoo
        //                      MMMMMMMMMMMMMMo"MMMo
        //                     "MMMMMMMMMMMMMMMMMMMMM
        //                     MMMMMMMMMMMMMMMMMMMMMMo
        //                     MMMM""MMMMMM"o" MMMMMMM
        //                     MMo o" MMM"  oo ""MMMMM
        //                     MM MMo MMM" MMoM "MMMMM
        //                     MMo"M"o" "" MMM" oMMMMM"
        //                     oMM M  o" " o "o MMMMMM"
        //                     oM"o " o "  o "o MMMMMMM
        //                     oMMoM o " M M "o MMMM"MMo
        //                      Mo " M "M "o" o  MMMoMMMo
        //                     MMo " "" M "       MMMMMMMo
        //                   oMM"   "o o "         MMMMMMMM
        //                  MMM"                    MMMMMMMMo
        //                oMMMo                     "MMMMMMMMo
        //               MMMMM o             "  " o" "MMMMMMMMMo
        //              MMMMM          "            " "MMMMMMMMMo
        //             oMMMM                          ""MMMMMMMMMo
        //            oMMMM         o         o         MMoMMMMMMM
        //            MMMM               o              "MMMMMMMMMM
        //           MMMM"     o    o             o     "MMMMMMMMMMo
        //         oMMMMM                                MMMMMMMMMMo
        //         MMM"MM                               "MMM"MMMMMMM
        //         MMMMMM           "      o   "         MMMMMMMMMMM
        //         "o  "ooo    o                     o o"MMMMMMMMoM"
        //        " o "o "MMo       "                o"  MMMMMMMM"
        //    o "o" o o "  MMMo                     o o""""MMMM"o" "
        // " o "o " o o" "  MMMMoo         "       o "o M"" M "o " "
        // "o o"  " o o" " " "MMMM"   o              M o "o" o" o" " o
        // M  o M "  o " " " " MM""           o    oMo"o " o o "o " "o "
        // o"  o " "o " " M " " o                MMMMo"o " o o o o" o o" "
        // o" "o " o " " o o" M "oo         ooMMMMMMM o "o o o " o o o "
        // M "o o" o" "o o o " o"oMMMMMMMMMMMMMMMMMMMo" o o "o "o o"
        //  "" "o"o"o"o o"o "o"o"oMMMMMMMMMMMMMMMMMMo"o"o "o o"oo"
        //        "" M Mo"o"oo"oM"" "               MMoM M M M
        //               """ """                      " """ "

        $(".secret").click(function() {
            --count;
            if (count == 0) {
                options.showRatings = true;
                saveOptions();
            }
        });
    // ===================================================================================================================================================================================
    // =    ===========    ========================================================================  ===================  =====  =======  ===================    =========================
    // ==  ===========  ==  =======================================================================  ===================  =====  =======  ==================  ==  ========================
    // ==  ===========  ========================================  =================================  ===================  =====  =======  ==================  ============================
    // ==  ===  = ===    ======   ===  =   ===  =  = ====   ===    ==  ===   ===  = =========   ===  ======   ===  =  ==  =====  =======  ======   ========    =====  =   ====   ====   ==
    // ==  ===     ===  ======     ==    =  ==        ==  =  ===  =======     ==     =======  =  ==    ===     ==  =  ==  ===    =======    ===  =  ========  ======    =  ==  =  ==  =  =
    // ==  ===  =  ===  ======  =  ==  =======  =  =  =====  ===  ===  ==  =  ==  =  ========  ====  =  ==  =  ==  =  ==  ==  =  =======  =  ==     ========  ======  =======     ==     =
    // ==  ===  =  ===  ======  =  ==  =======  =  =  ===    ===  ===  ==  =  ==  =  =========  ===  =  ==  =  ==  =  ==  ==  =  =======  =  ==  ===========  ======  =======  =====  ====
    // ==  ===  =  ===  ======  =  ==  =======  =  =  ==  =  ===  ===  ==  =  ==  =  =======  =  ==  =  ==  =  ==  =  ==  ==  =  =======  =  ==  =  ========  ======  =======  =  ==  =  =
    // =    ==  =  ===  =======   ===  =======  =  =  ===    ===   ==  ===   ===  =  ========   ===  =  ===   ====    ==  ===    =======    ====   =========  ======  ========   ====   ==
    // ===================================================================================================================================================================================
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
        case "chkUnits":
            options.showUnits = $('#chkUnits')[0].checked;
            break;
    }
    saveOptions();
}

function saveOptions() {
    chrome.storage.sync.set({
        'options': options
    }, () => {
        sendOptions(options);
    });
}
