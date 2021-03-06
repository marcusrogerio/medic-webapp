var _ = require('underscore'),
    moment = require('moment');

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');

  var ENTER_KEY_CODE = 13;

  inboxServices.factory('SearchFilters', ['$translate',
    function($translate) {

      var isEnter = function(e) {
        return e.which === ENTER_KEY_CODE;
      };
      
      var initFreetext = function(callback) {
        $('#search').on('click', function(e) {
          e.preventDefault();
          callback();
        });
        $('#freetext').on('keypress', function(e) {
          if (isEnter(e)) {
            e.preventDefault();
            callback();
          }
        });

        var performMobileSearch = function(e) {
          e.preventDefault();
          $(e.target).closest('.filter').removeClass('open');
          callback();
        };
        $('#mobile-search-go').on('click', performMobileSearch);
        $('#mobile-freetext').on('keypress', function(e) {
          if (isEnter(e)) {
            performMobileSearch(e);
          }
        });
        $('.mobile-freetext-filter').on('shown.bs.dropdown', function() {
          $('#mobile-freetext').focus();
        });

        // stop bootstrap closing the search pane on click
        $('.filters .mobile-freetext-filter .search-pane').on('click', function(e) {
          e.stopPropagation();
        });
      };

      var getMultidropdownOptions = function() {
        return $translate.onReady().then(function() {
          return {
            label: function(state, callback) {
              if (state.selected.length === 0 || state.selected.length === state.total.length) {
                return callback($translate.instant(state.menu.data('label-no-filter')));
              }
              if (state.selected.length === 1) {
                return callback(state.selected.first().text());
              }
              callback($translate.instant(
                state.menu.data('filter-label'), { number: state.selected.length }
              ));
            },
            selectAllLabel: $translate.instant('select all'),
            clearLabel: $translate.instant('clear')
          };
        });
      };

      var getMultidropdownResult = function(input) {
        var dropdown = input.multiDropdown();
        return {
          selected: dropdown.val(),
          options: dropdown.options()
        };
      };

      var initFormType = function(callback) {
        getMultidropdownOptions().then(function(options) {
          $('#formTypeDropdown').multiDropdown(options);
          $('#formTypeDropdown').on('update', function() {
            callback(getMultidropdownResult($(this)));
          });
        });
      };

      var initFacility = function(callback) {
        getMultidropdownOptions().then(function(options) {
          $('#facilityDropdown').multiDropdown(options);
          $('#facilityDropdown').on('update', function() {
            callback(getMultidropdownResult($(this)));
          });
        });
      };

      var getTernaryValue = function(positive, negative) {
        if (positive && !negative) {
          return true;
        }
        if (!positive && negative) {
          return false;
        }
      };

      var initStatus = function(callback) {
        $translate.onReady().then(function() {
          $('#statusDropdown').multiDropdown({
            label: function(state, callback) {
              var values = {};
              state.selected.each(function() {
                var elem = $(this);
                values[elem.data('value')] = elem.text();
              });
              var parts = [];
              if (values.valid && !values.invalid) {
                parts.push(values.valid);
              } else if (!values.valid && values.invalid) {
                parts.push(values.invalid);
              }
              if (values.verified && !values.unverified) {
                parts.push(values.verified);
              } else if (!values.verified && values.unverified) {
                parts.push(values.unverified);
              }
              if (parts.length === 0 || parts.length === state.total.length) {
                return callback($translate.instant(state.menu.data('label-no-filter')));
              }
              return callback(parts.join(', '));
            },
            selectAllLabel: $translate.instant('select all'),
            clearLabel: $translate.instant('clear')
          });
          $('#statusDropdown').on('update', function() {
            var values = $(this).multiDropdown().val();
            var valid = getTernaryValue(
              _.contains(values, 'valid'),
              _.contains(values, 'invalid')
            );
            var verified = getTernaryValue(
              _.contains(values, 'verified'),
              _.contains(values, 'unverified')
            );
            callback({
              valid: valid,
              verified: verified
            });
          });
        });
      };

      var isMobile = function() {
        return $('#mobile-detection').css('display') === 'inline';
      };

      var initDate = function(callback) {
        $translate.onReady().then(function() {
          $('#date-filter').daterangepicker({
            startDate: moment().subtract(1, 'months'),
            endDate: moment(),
            maxDate: moment(),
            opens: 'center',
            applyClass: 'btn-primary',
            cancelClass: 'btn-link',
            locale: {
              applyLabel: $translate.instant('Apply'),
              cancelLabel: $translate.instant('Cancel'),
              fromLabel: $translate.instant('date.from'),
              toLabel: $translate.instant('date.to'),
              daysOfWeek: moment.weekdaysMin(),
              monthNames: moment.monthsShort(),
              firstDay: moment.localeData()._week.dow
            }
          },
          function(start, end) {
            callback({
              from: start.valueOf(),
              to: end.valueOf()
            });
          })
          .on('show.daterangepicker', function(e, picker) {
            setTimeout(function() {
              if ($('#dateRangeDropdown').is('.disabled')) {
                picker.hide();
              }
            });
          })
          .on('mm.dateSelected.daterangepicker', function(e, picker) {
            if (isMobile()) {
              // mobile version - only show one calendar at a time
              if (picker.container.is('.show-from')) {
                picker.container.removeClass('show-from').addClass('show-to');
              } else {
                picker.container.removeClass('show-to').addClass('show-from');
                picker.hide();
              }
            }
          });
          $('.daterangepicker').addClass('filter-daterangepicker mm-dropdown-menu show-from');
        });
      };

      return {
        freetext: initFreetext,
        formType: initFormType,
        status: initStatus,
        date: initDate,
        facility: initFacility,
        reset: function() {
          $('.filter.multidropdown').each(function() {
            $(this).multiDropdown().reset();
          });
        }
      };
    }
  ]);

}());
