const THRESHOLD_CASES = 50;
const THRESHOLD_DEATHS = 10;
const DAYS_BEFORE_THRESHOLD = 10;

$(function () {
    $('#field-threshold-cases').val(THRESHOLD_CASES);
    $('#field-threshold-deaths').val(THRESHOLD_DEATHS);
    $('#field-days-before-threshold').val(DAYS_BEFORE_THRESHOLD);
    load();
});

$('input[name=source], input[name=source-value], input[name=source-scaling], input[name=scaling], input[name=sorting]').change(function () {
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

    setHideButton('hide');
    switch ($('input[name=source]:checked').val()) {
        case 'johns-hopkins-csse-confirmed':
            loadJHCSSEConfirmed(displayData);
            break;
        case 'johns-hopkins-csse-deaths':
            loadJHCSSEDeaths(displayData);
            break;
    }
}

function displayData(regions, lowestDate, lowestThreshold, dataType) {
    var series = new Array();
    var minDate = null;
    var regionsSorted = [];
    var daysBeforeThreshold = parseInt($('#field-days-before-threshold').val());
    var sorting = $('input[type=radio][name=sorting]:checked').val();
    var sourceValue = $('input[type=radio][name=source-value]:checked').val();
    var sourceScaling = $('input[type=radio][name=source-scaling]:checked').val();

    minDate = lowestDate.subtract(daysBeforeThreshold, 'days');
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
                var dayObj = moment(day, "YYYY/MM/DD");
                var daysSinceStart = moment.duration(dayObj.diff(region.reachedThresholdAt, 'days'));
                var dateCorrected = moment(day, "YYYY/MM/DD").subtract(region.dayDiffToLowest, "days");


                var currentValue;
                var addedFromLast;
                if (sourceScaling == 'relative') {

                    addedFromLast = lastValue == null ? null : region.byDayRelative[day] - lastValue;
                    currentValue = region.byDayRelative[day];
                    if (sourceValue == 'new') currentValue = addedFromLast;
                } else {
                    addedFromLast = lastValue == null ? null : region.byDay[day] - lastValue;
                    currentValue = region.byDay[day];
                    if (sourceValue == 'new') currentValue = addedFromLast;
                }
                if (dateCorrected >= minDate) {
                    points.push({
                        x: dateCorrected.toDate(),
                        real: dayObj,
                        daysSinceStart: daysSinceStart,
                        region: region,
                        dataType: dataType,
                        y: currentValue,
                        addedFromLast: addedFromLast,
                        sourceScaling: sourceScaling,
                        total: region.byDay[day]
                    });
                }

                lastValue = sourceScaling == 'relative' ?
                    region.byDayRelative[day] : region.byDay[day];

            });

            series.push({
                name: region.country,
                color: region.country.toColor(),
                data: points
            });
        }
    });
    $('#loading-indicator').addClass("d-none");

    Highcharts.chart('chart', getChartOptions(lowestThreshold, series, dataType));
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
    var lowestThreshold = null;
    var dateRegex = "([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2})\\w+";
    var regions = {};
    var sourceScaling = $('input[type=radio][name=source-scaling]:checked').val();

    $.get({
        url: "data/un_populationdata.csv",
        cache: true,
        complete: function (populationData) {
            populationData = csvToArray(populationData.responseText, ';');
            populationData.shift();

            var populationByCountry = {};
            populationData.forEach(function (row) {
                populationByCountry[row[0]] = parseInt(row[1]);
            });

            $('body').append('<textarea>' + JSON.stringify(populationByCountry) + '</textarea>');

            $.get({
                url: url,
                cache: true,
                complete: function (data) {
                    var cellData = csvToArray(data.responseText);
                    var dateIdxs = {};

                    var headlineCells = cellData[0];

                    headlineCells.forEach(function (headlineCell, headlineCellIdx) {
                        if (headlineCell.match(dateRegex)) {
                            var date = moment(headlineCell);
                            var dateFormatted = date.format("YYYY/MM/DD");
                            dateIdxs[dateFormatted] = headlineCellIdx;
                        }
                    });


                    cellData.shift();
                    cellData.forEach(function (cells, idx) {

                        var countryName = cells[1];
                        if (countryName != undefined) {
                            if (!regions[countryName]) {
                                var population = null;
                                if (populationByCountry[countryName]) {
                                    population = populationByCountry[countryName];
                                }

                                regions[countryName] = {
                                    country: countryName,
                                    reachedThresholdAt: null,
                                    reachedThreshold: false,
                                    dayDiffToLowest: 0,
                                    fullCaseCount: 0,
                                    population: population,
                                    byDay: {},
                                    byDayRelative: {}
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
                        }
                    });

                    Object.keys(regions).forEach(function (countryName) {
                        var region = regions[countryName];
                        Object.keys(region.byDay).forEach(function (date) {
                            region.byDayRelative[date] = (region.byDay[date] / region.population) * 100000
                        });
                    });

                    Object.keys(regions).forEach(function (countryName) {
                        var region = regions[countryName];
                        Object.keys(region.byDay).forEach(function (date) {
                            var dateObj = moment(date, "YYYY/MM/DD");

                            if (region.byDay[date] >= threshold) {
                                if (!region.reachedThreshold) {
                                    region.reachedThresholdAt = dateObj;
                                    console.log(region.country + " reached threshold " + threshold + " with " + region.byDay[date] + " at " + dateObj);
                                }
                                region.reachedThreshold = true;

                                if (region.byDay[date] > region.fullCaseCount) {
                                    region.fullCaseCount = region.byDay[date];
                                }
                                if (lowestThreshold == null ||
                                    lowestThreshold > dateObj) {
                                    lowestThreshold = dateObj;
                                }

                            }
                            if (lowestDate == null ||
                                lowestDate > dateObj) {
                                lowestDate = dateObj;
                            }
                        });
                    });

                    Object.keys(regions).forEach(function (country) {
                        var region = regions[country];
                        region.dayDiffToLowest = Math.round((region.reachedThresholdAt - lowestDate) / (1000 * 60 * 60 * 24));
                    });
                    $('body').append('<textarea>' + JSON.stringify(regions) + '</textarea>');
                    cb(regions, lowestDate, lowestThreshold, dataType);
                }
            });
        }
    });
}

Highcharts.Point.prototype.tooltipFormatter = function (useHeader) {
    var point = this;
    var dataType = point.dataType == "cases" ? "confirmed cases" : "deaths";
    var addedFromLast = point.addedFromLast == null ? "" : "new " + dataType + ": " + point.addedFromLast + "<br />";
    var realDate = point.real.format("YYYY/MM/DD");
    var scalingHint = point.sourceScaling == "relative" ? (" per 100 000 inhabitants<br>Total: " + point.total + " " + dataType + "<br>Population: " + point.region.population) : "";
    return "<b>" + point.region.country + " </b> | Day " + point.daysSinceStart + "<br/>" + point.y.toFixed(0) + " " + dataType + scalingHint + "<br />" + addedFromLast + "Offset: " + point.region.dayDiffToLowest + " days<br/>" + realDate;
}

// Return array of string values, or NULL if CSV string not well formed.
function csvToArray(text, separator = ',') {
    var re = '(".*?"|[^"' + separator + ']+)(?=\s*' + separator + '|\s*$)';
    var re_value = new RegExp(re, "g");
    // Return NULL if input string is not well formed CSV string.
    var r = []; // Initialize array to receive values.
    var lines = text.replace('\r', '').split('\n');

    lines.forEach(function (line) {
        var a = [];
        if (line[0] == separator) a.push('');
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
        if (new RegExp(separator + '\s*$').test(text)) a.push('');

        r.push(a);
    });

    return r;
};

$('#toggle-series').click(function () {
    var status = $(this).attr('data-hide');
    setChartHiddenStatus(status);
});

function setHideButton(status) {
    if (status == "show") {
        $(this).attr('data-hide', 'show');
        $(this).text('Show all');
    } else {

        $(this).attr('data-hide', 'hide');
        $(this).text('Hide all');
    }
}

function setChartHiddenStatus(status) {
    var chart = $('#chart').highcharts();
    if (status == "hide") {
        $.each(chart.series, function (i, series) {
            console.log(series.name);
            series.setVisible(false, false);
        });
        setHideButton('show');
    } else {
        $.each(chart.series, function (i, series) {
            console.log(series.name);
            series.setVisible(true, false);
        });

        setHideButton('hide');
    }
    chart.redraw();
}

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
                value: lowestDate.toDate(),
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
                pointStart: lowestDate.toDate()
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