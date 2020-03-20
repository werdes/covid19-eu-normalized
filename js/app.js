$(function () {
    loadIsaacLin(displayData);
});

var _ENUM_SOURCES = {
    ISAAC_LIN: 0,
    JOHN_HOPKINS_CSSE_CONFIRMED: 1,
    JOHN_HOPKINS_CSSE_DEATHS: 2,
}

$('input[name=source]').change(function () {
    $('#loading-indicator').removeClass("d-none");

    switch ($(this).val()) {
        case 'isaac-lin':
            loadIsaacLin(displayData);
            break;
        case 'john-hopkins-csse-confirmed':
            loadJHCSSEConfirmed(displayData);
            break;
        case 'john-hopkins-csse-deaths':
            loadJHCSSEDeaths(displayData);
            break;
    }
});


function displayData(regions, lowestDate) {
    var series = new Array();
    Object.keys(regions).forEach(function (country) {
        var region = regions[country];

        if (region.reachedThreshold) {

            var points = new Array();
            Object.keys(region.byDay).forEach(function (day) {
                var daysSinceStart = 1 + Math.round(((new Date(day)) - region.reachedThresholdAt) / (1000 * 60 * 60 * 24));

                var dateCorrected = new Date(day);
                dateCorrected.setDate(dateCorrected.getDate() - region.dayDiffToLowest);
                points.push({
                    x: dateCorrected,
                    real: new Date(day),
                    daysSinceStart: daysSinceStart,
                    region: region,
                    y: region.byDay[day]
                });
            });

            series.push({
                name: country,
                data: points
            });

            //console.log(country + " done");
        }
    });
    $('#loading-indicator').addClass("d-none");
    // $('body').append("<textarea>" + JSON.stringify(regions) + "</textarea>");

    Highcharts.chart('chart', getChartOptions(lowestDate, series));
}

function loadJHCSSEConfirmed(cb) {
    loadJHCSSE(cb, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv");
}

function loadJHCSSEDeaths(cb) {
    loadJHCSSE(cb, "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv");
}

function loadJHCSSE(cb, url) {
    var lowestDate = null;
    var dateRegex = "([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2})\\w+";
    var regions = {};

    $.get({
        url: url,
        cache: true,
        complete: function (data) {
            var lines = data.responseText.replace('\r', '').split('\n');

            var dateIdxs = {};
            var headline = lines[0];

            var headlineCells = headline.split(',');


            headlineCells.forEach(function (headlineCell, headlineCellIdx) {
                if (headlineCell.match(dateRegex)) {
                    var date = new Date(headlineCell);
                    var dateFormatted = date.getFullYear() + '/' + ("0" + (date.getMonth() + 1)).slice(-2) + '/' + ("0" + date.getDate()).slice(-2);
                    dateIdxs[dateFormatted] = headlineCellIdx;
                }
            });


            lines.shift();
            lines.forEach(function (line, idx) {
                var cells = line.split(',');
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


                Object.keys(dateIdxs).forEach(function (date) {
                    var lineDateIdx = dateIdxs[date];
                    var value = parseInt(cells[lineDateIdx]);
                    var dateObj = new Date(date);

                    if (!region.byDay[date])
                        region.byDay[date] = 0;

                    region.byDay[date] += value;

                    if (value >= 100) {
                        if (!region.reachedThreshold)
                            region.reachedThresholdAt = dateObj;
                        region.reachedThreshold = true;

                        if (value > region.fullCaseCount) {
                            region.fullCaseCount = value;
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


            $('body').append("<textarea>" + JSON.stringify(regions) + "</textarea>");

            cb(regions, lowestDate);
        }
    });
}

function loadIsaacLin(cb) {
    var lowestDate = null;
    $.get({
        url: "https://raw.githubusercontent.com/BlankerL/DXY-COVID-19-Data/master/json/DXYArea-TimeSeries.json",
        cache: true,
        dataType: "json",
        complete: function (data) {

            var regions = {};

            data.responseJSON.forEach(function (regionSnapshot, idx) {
                if (regionSnapshot.countryEnglishName &&
                    regionSnapshot.provinceEnglishName == regionSnapshot.countryEnglishName &&
                    regionSnapshot.continentEnglishName == "Europe") {
                    if (!regions[regionSnapshot.countryEnglishName]) {

                        regions[regionSnapshot.countryEnglishName] = {
                            country: regionSnapshot.countryEnglishName,
                            reachedThresholdAt: null,
                            reachedThreshold: false,
                            dayDiffToLowest: 0,
                            snapshots: new Array(),
                            fullCaseCount: 0,
                            byDay: {}
                        }
                    };

                    var region = regions[regionSnapshot.countryEnglishName];

                    region.snapshots.push(regionSnapshot);

                    if (regionSnapshot.confirmedCount >= 100) {
                        region.reachedThreshold = true;
                        if (region.reachedThresholdAt == null ||
                            region.reachedThresholdAt > new Date(regionSnapshot.updateTime)) {

                            var updateTimeDate = new Date(regionSnapshot.updateTime);

                            region.reachedThresholdAt = updateTimeDate;

                            if (lowestDate == null ||
                                lowestDate > updateTimeDate) {
                                lowestDate = updateTimeDate;
                            }
                        }

                        if (region.fullCaseCount < regionSnapshot.confirmedCount) {
                            region.fullCaseCount = regionSnapshot.confirmedCount;
                        }
                    }
                }

            });

            Object.keys(regions).forEach(function (country) {
                var region = regions[country];
                region.dayDiffToLowest = Math.round((region.reachedThresholdAt - lowestDate) / (1000 * 60 * 60 * 24));

                if (region.reachedThreshold) {
                    region.snapshots.sort(function (a, b) {
                        return a.updateTime - b.updateTime;
                    });

                    region.snapshots.forEach(function (snapshot) {
                        var date = new Date(snapshot.updateTime);
                        var dateFormatted = date.getFullYear() + '/' + ("0" + (date.getMonth() + 1)).slice(-2) + '/' + ("0" + date.getDate()).slice(-2);

                        if (!region.byDay[dateFormatted]) {
                            region.byDay[dateFormatted] = snapshot.confirmedCount;
                        }

                        if (region.byDay[dateFormatted] < snapshot.confirmedCount) {
                            //console.log("overwritten " + country + "/" + dateFormatted + ":" + region.byDay[dateFormatted] + "->" + snapshot.confirmedCount);
                            region.byDay[dateFormatted] = snapshot.confirmedCount;
                        }
                    });
                    region.snapshots = null;
                }
            });
            cb(regions, lowestDate);
        }
    });
}

Highcharts.Point.prototype.tooltipFormatter = function (useHeader) {
    var point = this;
    var realDate = point.real.getFullYear() + '/' + ("0" + (point.real.getMonth() + 1)).slice(-2) + '/' + ("0" + point.real.getDate()).slice(-2);
    return "<b>" + point.region.country + " </b> | Day " + point.daysSinceStart + "<br/>" + point.y + " confirmed cases<br />Offset: " + point.region.dayDiffToLowest + " days<br/>" + realDate;
}



function getChartOptions(lowestDate, series) {
    return {
        chart: {
            zoomType: "xy",
        },
        title: {
            text: ''
        },
        yAxis: {
            title: {
                text: 'confirmed cases'
            }
        },
        xAxis: {
            // type: 'datetime',
            labels: {
                align: 'left',
                formatter: function () {
                    return "";
                    var oCorrectedDate = moment.utc(this.value).add(15, 'minutes').local().format("HH:mm");
                    return oCorrectedDate;
                }
            }
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