const THRESHOLD_CASES = 50;
const THRESHOLD_DEATHS = 10;
const DAYS_BEFORE_THRESHOLD = 10;

$(function () {
    $('#field-threshold-cases').val(THRESHOLD_CASES);
    $('#field-threshold-deaths').val(THRESHOLD_DEATHS);
    $('#field-days-before-threshold').val(DAYS_BEFORE_THRESHOLD);
    load();
});

$('input[name=source]').change(function () {
    load();
});
$('input[name=scaling]').change(function () {
    load();
});
$('input[name=sorting]').change(function () {
    load();
});
$('.threshold-option').change(function () {
    load();
});

function load() {
    $('#loading-indicator').removeClass("d-none");

    $('#threshold-cases').text($('#field-threshold-cases').val());
    $('#threshold-deaths').text($('#field-threshold-deaths').val());
    $('#days-before-threshold').text($('#field-days-before-threshold').val());

    switch ($('input[name=source]:checked').val()) {
        case 'john-hopkins-csse-confirmed':
            loadJHCSSEConfirmed(displayData);
            break;
        case 'john-hopkins-csse-deaths':
            loadJHCSSEDeaths(displayData);
            break;
    }
}

function displayData(regions, lowestDate, dataType) {
    var series = new Array();
    var minDate = new Date();
    var regionsSorted = [];
    var daysBeforeThreshold = parseInt($('#field-days-before-threshold').val());
    var sorting = $('input[type=radio][name=sorting]:checked').val();

    minDate.setDate(lowestDate.getDate() - daysBeforeThreshold);
    console.log(lowestDate + " -> " + minDate);

    Object.keys(regions).forEach(function (country) {
        regionsSorted.push(regions[country]);
    });

    regionsSorted.sort(function (a, b) {
        if (sorting == 'alphabetical') return a.country.replace("\"", "").localeCompare(b.country.replace("\"", ""));
        return b.fullCaseCount - a.fullCaseCount;
    });

    //Object.keys(regionsSorted).forEach(function (country) {
    regionsSorted.forEach(function (region, regionIdx) {
        //var region = regions[country];

        if (region.reachedThreshold) {

            var points = new Array();
            var lastValue = null;
            Object.keys(region.byDay).forEach(function (day) {
                var daysSinceStart = 1 + Math.round(((new Date(day)) - region.reachedThresholdAt) / (1000 * 60 * 60 * 24));

                var dateCorrected = new Date(day);
                dateCorrected.setDate(dateCorrected.getDate() - region.dayDiffToLowest);

                var addedFromLast = lastValue == null ? null : region.byDay[day] - lastValue;

                if (dateCorrected >= minDate) {
                    points.push({
                        x: dateCorrected,
                        real: new Date(day),
                        daysSinceStart: daysSinceStart,
                        region: region,
                        dataType: dataType,
                        y: region.byDay[day],
                        addedFromLast: addedFromLast
                    });
                }

                lastValue = region.byDay[day];
            });

            series.push({
                name: region.country,
                color: region.country.toColor(),
                data: points
            });
        }
    });
    $('#loading-indicator').addClass("d-none");

    Highcharts.chart('chart', getChartOptions(lowestDate, series, dataType));
}

function loadJHCSSEConfirmed(cb) {
    var threshold = parseInt($('#field-threshold-cases').val());

    loadJHCSSE(cb, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv", "cases", threshold);
}

function loadJHCSSEDeaths(cb) {
    var threshold = parseInt($('#field-threshold-deaths').val());

    loadJHCSSE(cb, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv", "deaths", threshold);
}

function loadJHCSSE(cb, url, dataType, threshold) {
    var lowestDate = null;
    var dateRegex = "([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2})\\w+";
    var regions = {};

    $.get({
        url: url,
        cache: true,
        complete: function (data) {
            var cellData = csvToArray(data.responseText);
            var dateIdxs = {};

            var headlineCells = cellData[0];

            headlineCells.forEach(function (headlineCell, headlineCellIdx) {
                if (headlineCell.match(dateRegex)) {
                    var date = new Date(headlineCell);
                    var dateFormatted = date.getFullYear() + '/' + ("0" + (date.getMonth() + 1)).slice(-2) + '/' + ("0" + date.getDate()).slice(-2);
                    dateIdxs[dateFormatted] = headlineCellIdx;
                }
            });


            cellData.shift();
            cellData.forEach(function (cells, idx) {

                var countryName = cells[1];
                if (!regions[countryName]) {
                    regions[countryName] = {
                        country: countryName,
                        reachedThresholdAt: null,
                        reachedThreshold: false,
                        dayDiffToLowest: 0,
                        fullCaseCount: 0,
                        byDay: {}
                    }
                }

                var region = regions[countryName];

                // if (region.country != "France") return;

                Object.keys(dateIdxs).forEach(function (date) {
                    var lineDateIdx = dateIdxs[date];
                    var value = parseInt(cells[lineDateIdx]);

                    if (!region.byDay[date])
                        region.byDay[date] = 0;

                    region.byDay[date] += value;
                });
            });

            Object.keys(regions).forEach(function (countryName) {
                var region = regions[countryName];
                Object.keys(region.byDay).forEach(function (date) {
                    var dateObj = new Date(date);

                    if (region.byDay[date] >= threshold) {
                        if (!region.reachedThreshold) {
                            region.reachedThresholdAt = dateObj;
                            console.log(region.country + " reached threshold " + threshold + " with " + region.byDay[date] + " at " + dateObj);
                        }
                        region.reachedThreshold = true;

                        if (region.byDay[date] > region.fullCaseCount) {
                            region.fullCaseCount = region.byDay[date];
                        }
                        if (lowestDate == null ||
                            lowestDate < dateObj) {
                            lowestDate = dateObj;
                        }

                    }

                });
            });

            Object.keys(regions).forEach(function (country) {
                var region = regions[country];
                region.dayDiffToLowest = Math.round((region.reachedThresholdAt - lowestDate) / (1000 * 60 * 60 * 24));
            });

            cb(regions, lowestDate, dataType);
        }
    });
}

Highcharts.Point.prototype.tooltipFormatter = function (useHeader) {
    var point = this;
    var dataType = point.dataType == "cases" ? "confirmed cases" : "deaths";
    var addedFromLast = point.addedFromLast == null ? "" : "new " + dataType + ": " + point.addedFromLast + "<br />";
    var realDate = point.real.getFullYear() + '/' + ("0" + (point.real.getMonth() + 1)).slice(-2) + '/' + ("0" + point.real.getDate()).slice(-2);
    return "<b>" + point.region.country + " </b> | Day " + point.daysSinceStart + "<br/>" + point.y + " " + dataType + "<br />" + addedFromLast + "Offset: " + point.region.dayDiffToLowest + " days<br/>" + realDate;
}

// Return array of string values, or NULL if CSV string not well formed.
function csvToArray(text) {
    var re_value = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
    // Return NULL if input string is not well formed CSV string.
    var r = []; // Initialize array to receive values.
    var lines = text.replace('\r', '').split('\n');

    lines.forEach(function (line) {
        var a = [];
        if (line[0] == ',') a.push('');
        line.replace(re_value, // "Walk" the string using replace with callback.
            function (m0, m1, m2, m3) {
                // Remove backslash from \' in single quoted values.
                if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
                // Remove backslash from \" in double quoted values.
                else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
                else if (m3 !== undefined) a.push(m3);
                return ''; // Return empty string.
            });
        // Handle special case of empty last value.
        if (/,\s*$/.test(text)) a.push('');

        r.push(a);
    });

    return r;
};

function getChartOptions(lowestDate, series, dataType) {
    var scaling = $('input[type=radio][name=scaling]:checked').val();
    dataType = dataType == "cases" ? "Confirmed cases" : "Deaths";
    return {
        chart: {
            zoomType: "xy",
        },
        title: {
            text: ''
        },
        yAxis: {
            type: scaling,
            title: {
                text: dataType
            }
        },
        xAxis: {
            // type: 'datetime',
            labels: {
                align: 'left',
                formatter: function () {
                    return "";
                }
            },
            plotLines: [{
                color: 'black',
                value: lowestDate,
                width: 1,
                label: {
                    formatter: function () {
                        return "Threshold";
                    }
                }
            }]
        },

        legend: {
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'middle'
        },

        tooltip: {
            headerFormat: "",
            useHtml: true
        },

        plotOptions: {
            series: {
                label: {
                    connectorAllowed: false
                },
                pointStart: lowestDate
            }
        },

        series: series,
        responsive: {
            rules: [{
                condition: {
                    maxWidth: 500
                },
                chartOptions: {
                    legend: {
                        layout: 'horizontal',
                        align: 'center',
                        verticalAlign: 'bottom'
                    }
                }
            }]
        }
    }
}

String.prototype.toColor = function () {
    var hash = 0;
    for (var i = 0; i < this.length; i++) {
        hash = this.charCodeAt(i) + ((hash << 5) - hash);
    }
    var colour = '#';
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xFF;
        colour += ('00' + value.toString(16)).substr(-2);
    }
    return colour;
}