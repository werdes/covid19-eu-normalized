$(function () {
    $.get({
        url: "https://raw.githubusercontent.com/BlankerL/DXY-COVID-19-Data/master/json/DXYArea-TimeSeries.json",
        cache: true,
        dataType: "json",
        complete: function (data) {

            var regions = {};
            var series = new Array();
            var lowestDate = null;

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
                            console.log("overwritten " + country + "/" + dateFormatted + ":" + region.byDay[dateFormatted] + "->" + snapshot.confirmedCount);
                            region.byDay[dateFormatted] = snapshot.confirmedCount;
                        }
                    });


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

                    console.log(country + " done");
                }
                region.snapshots = null;
            });
            $('#loading-indicator').addClass("d-none");
            // $('body').append("<textarea>" + JSON.stringify(regions) + "</textarea>");

            Highcharts.chart('chart', getChartOptions(lowestDate, series));
        }
    });
});

Highcharts.Point.prototype.tooltipFormatter = function (useHeader) {
    var point = this;

    //var cFlatteningNote = oPoint.flattened && oPoint.seriesindex == 0 ? '<br />! This value has been altered by the error correction mechanism !' : '';
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