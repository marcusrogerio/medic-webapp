if ( typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function' ) {
    var define = function( factory ) {
        factory( require, exports, module );
    };
}

define( function( require, exports, module ) {
    var widgets = [
        require( 'enketo-core/src/widget/geo/geopicker' ),
        require( 'enketo-core/src/widget/table/tablewidget' ),
        require( 'enketo-core/src/widget/radio/radiopicker' ),
        require( 'enketo-core/src/widget/date/datepicker-extended' ),
        require( 'enketo-core/src/widget/time/timepicker-extended' ),
        require( 'enketo-core/src/widget/datetime/datetimepicker-extended' ),
        require( 'enketo-core/src/widget/horizontal-choices/horizontalchoices' ),
        require( './widgets/notewidget' ),
        require( './widgets/countdown-widget' ),
        require( './widgets/db-object-widget' ),
        require( './widgets/phone-widget' ),
        require( './widgets/unselectable-radios' ),
        require( './widgets/android-datepicker' ),
        require( './widgets/z-score' ),
    ];

    module.exports = widgets;
} );
