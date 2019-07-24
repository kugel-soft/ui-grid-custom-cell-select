// Custom multi-cell selection directive for UI-Grid
// Created by brendenjpeterson@gmail.com

angular.module('ui.grid')
.directive('uiGridCustomCellSelect', ['$timeout', '$document', '$filter', 'rowSearcher', 'uiGridConstants', '$parse', 'uiGridCellNavConstants', '$window', function ($timeout, $document, $filter, rowSearcher, uiGridConstants, $parse, uiGridCellNavConstants, $window) {
    var DIRECTIONS = { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT' };
    var HIDDEN_INPUT_VALUE = '##HIDDEN_INPUT_VALUE##';

    return {
        replace: true,
        require: '^uiGrid',
        scope: false,
        controller: function () { },
        compile: function () {
            return {
                pre: function ($scope, $elm, $attrs, uiGridCtrl) { },
                post: function ($scope, $elm, $attrs, uiGridCtrl) {
                    var _scope = $scope;
                    var grid = uiGridCtrl.grid;


                    // Data setup
                    _scope.ugCustomSelect = {
                        hiddenInput: angular.element('<input style="height: 0px; width: 0px; position: absolute; top: 0; z-index: -1;" type="text" value="' + HIDDEN_INPUT_VALUE + '" />').appendTo($elm),
                        isDragging: false,
                        lastMouseMoveEvt: null,
                        dragDirection: {},
                        selectedCells: [],
                        dragData: {
                            startCell: {
                                row: null,
                                col: null
                            },
                            endCell: {
                                row: null,
                                col: null
                            }
                        }
                    }

                    // Bind events
                    $timeout(function () {
                        grid.element.on('mousedown', '.ui-grid-cell-contents', dragStart);
                        grid.element.on('mouseenter', '.ui-grid-cell-contents', mouseEnterCell);
                        grid.element.on('mousemove', '.ui-grid-cell-contents', mouseMoveCell);
                        angular.element('body').on('mouseup', bodyMouseUp);
                        angular.element(document).on('keydown', documentKeyUp);
                        angular.element(document).on('copy', documentCopyCells);

                        grid.api.core.on.filterChanged(_scope, clearDragData);
                        grid.api.core.on.columnVisibilityChanged(_scope, clearDragData);
                        grid.api.core.on.rowsVisibleChanged(_scope, clearDragData);
                        grid.api.core.on.sortChanged(_scope, clearDragData);

                        angular.element(document).on('paste', pasteCellData);
                    });

                    // Events
                    function dragStart(evt) {
                        if (angular.element(evt.target).hasClass('ui-grid-cell-contents')) {
                            if (evt.button == 0) {
                                var cellData = $(this).data().$scope;
                                clearDragData();
                                _scope.ugCustomSelect.isDragging = true;
                                _scope.ugCustomSelect.lastMouseMoveEvt = evt;
                                setStartCell(cellData.row, cellData.col);
                                setSelectedStates();
                            } else if (evt.button == 2) {
                                evt.target.contentEditable = true;

                                var hiddenInput = _scope.ugCustomSelect.hiddenInput[0];
                                hiddenInput.value = HIDDEN_INPUT_VALUE;
                                hiddenInput.select();

                                setTimeout(function() {
                                    evt.target.contentEditable = false;
                                }, 500);
                            }
                        }
                    }

                    function mouseEnterCell(evt) {
                        if (_scope.ugCustomSelect.isDragging) {
                            var cellData = $(this).data().$scope;
                            if (cellData) {
                                setEndCell(cellData.row, cellData.col);
                                setSelectedStates();
                            }
                        }
                    }

                    function mouseMoveCell(evt) {
                        if (_scope.ugCustomSelect.isDragging && _scope.ugCustomSelect.lastMouseMoveEvt) {
                            if (_scope.ugCustomSelect.lastMouseMoveEvt) {
                                var lastEvt = _scope.ugCustomSelect.lastMouseMoveEvt;
                                _scope.ugCustomSelect.dragDirection.horizontal = '';
                                _scope.ugCustomSelect.dragDirection.vertical = '';

                                if (Math.abs(lastEvt.pageX - evt.pageX) >= 10) {
                                    if (lastEvt.pageX < evt.pageX) {
                                        _scope.ugCustomSelect.dragDirection.horizontal = DIRECTIONS.RIGHT;
                                    } else if (lastEvt.pageX > evt.pageX) {
                                        _scope.ugCustomSelect.dragDirection.horizontal = DIRECTIONS.LEFT;
                                    }
                                }

                                if (Math.abs(lastEvt.pageY - evt.pageY) >= 10) {
                                    if (lastEvt.pageY < evt.pageY) {
                                        _scope.ugCustomSelect.dragDirection.vertical = DIRECTIONS.DOWN;
                                    } else if (lastEvt.pageY > evt.pageY) {
                                        _scope.ugCustomSelect.dragDirection.vertical = DIRECTIONS.UP;
                                    }
                                }

                                if (_scope.ugCustomSelect.dragDirection.horizontal || _scope.ugCustomSelect.dragDirection.vertical) {
                                    var cellData = $(this).data().$scope;
                                    if (cellData) {
                                        var nextCell = getNextPossibleDragCell(cellData, evt);
                                        grid.api.core.scrollToIfNecessary(nextCell.row, nextCell.col);
                                    }

                                    _scope.ugCustomSelect.lastMouseMoveEvt = evt;
                                }
                            }
                        }
                    }

                    function bodyMouseUp(evt) {
                        if (_scope.ugCustomSelect.isDragging) {
                            _scope.ugCustomSelect.isDragging = false;
                            _scope.ugCustomSelect.lastMouseMoveEvt = null;
                            _scope.ugCustomSelect.dragDirection = {};
                            setSelectedStates();
                        }
                    }

                    function getNextPossibleDragCell(cell, evt) {
                        var nextCell = { row: cell.row, col: cell.col };

                        if (_scope.ugCustomSelect.dragDirection.horizontal) {
                            var focusableCols = grid.renderContainers.body.cellNav.getFocusableCols();
                            var curColIndex = focusableCols.indexOf(cell.col);

                            if (_scope.ugCustomSelect.dragDirection.horizontal == DIRECTIONS.RIGHT) {
                                if (curColIndex < focusableCols.length - 1) {
                                    nextCell.col = focusableCols[curColIndex + 1];
                                }
                            } else {
                                if (curColIndex > 0) {
                                    nextCell.col = focusableCols[curColIndex - 1];
                                }
                            }
                        }

                        if (_scope.ugCustomSelect.dragDirection.horizontal) {
                            var focusableRows = grid.renderContainers.body.cellNav.getFocusableRows();
                            var curRowIndex = focusableRows.indexOf(cell.row);

                            if (_scope.ugCustomSelect.dragDirection.horizontal == DIRECTIONS.DOWN) {
                                if (curRowIndex < focusableRows.length - 1) {
                                    nextCell.row = focusableRows[curRowIndex + 1];
                                }
                            } else {
                                if (curRowIndex > 0) {
                                    nextCell.row = focusableRows[curRowIndex - 1];
                                }
                            }
                        }
                        return nextCell;
                    }

                    function documentKeyUp(evt) {
                        var cKey = 67, vKey = 86;

                        // When ctrl+C or cmd+C
                        if (evt.keyCode === cKey && (evt.ctrlKey || evt.metaKey) && window.getSelection() + '' === '') {
                            document.execCommand('copy');
                            evt.preventDefault();
                        }
                    }

                    function documentCopyCells(evt) {
                        var cbData,
                            cbType;

                        if (evt.originalEvent.clipboardData) {
                            cbData = evt.originalEvent.clipboardData;
                            cbType = 'text/plain';
                        } else {
                            cbData = window.clipboardData;
                            cbType = 'Text';
                        }

                        if (cbData && angular.element(document.activeElement).parents('.ui-grid').length > 0 && (window.getSelection() + '' === '' || window.getSelection() + '' === ' ' || window.getSelection() == HIDDEN_INPUT_VALUE) && grid.cellNav.focusedCells.length > 0) {
                            cbData.setData(cbType, createCopyData());
                            evt.preventDefault();
                        }
                    }

                    function pasteCellData(evt) {
                        var clipboardData = evt.originalEvent.clipboardData || window.clipboardData;

                        if (!clipboardData) {
                            console.log('Clipboard API not supported in browser');
                            return;
                        }

                        var pastedData = clipboardData.getData('Text');

                        var firstCell = grid.cellNav.focusedCells[0];
                        if (firstCell) {
                            var row = firstCell.row.uid;
                            var col = firstCell.col.uid;
                            var visibleRows = grid.getVisibleRows();
                            var columns = grid.columns;
                            for (var i = 0; i < visibleRows.length; i++) {
                                var visibleRow = visibleRows[i];
                                if (visibleRow.uid === row) {
                                    for (var j = 0; j < columns.length; j++) {
                                        var column = columns[j];
                                        if (column.uid === col) {
                                            var pastedRows = pastedData.split('\n');
                                            for (var k = 0; k < pastedRows.length - 1; k++) {
                                                var pastedRow = pastedRows[k];
                                                if (i + k < visibleRows.length) {
                                                    var pastedCells = pastedRow.split('\t');
                                                    for (var l = 0; l < pastedCells.length; l++) {
                                                        var pastedCell = pastedCells[l];
                                                        if (j + l < columns.length) {
                                                            var column = columns[j + l];
                                                            if (column.colDef.enableCellEdit) {
                                                                var atrib = columns[j + l].field;
                                                                var getter = $parse(atrib);
                                                                var setter = getter.assign;
                                                                var rowEntity = visibleRows[i + k].entity;
                                                                var oldValue = getter(rowEntity);

                                                                var newValue = pastedCell;
                                                                if (column.colDef.type == 'number') {
                                                                    newValue = parseFloat(newValue) || 0;
                                                                }
                                                                setter(rowEntity, newValue);

                                                                grid.api.edit.raise.afterCellEdit(rowEntity, column.colDef, newValue, oldValue);
                                                                grid.api.core.refresh();
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    // Functions
                    function setStartCell(row, col) {
                        _scope.ugCustomSelect.dragData.startCell.row = row;
                        _scope.ugCustomSelect.dragData.startCell.col = col;
                    }

                    function setEndCell(row, col) {
                        _scope.ugCustomSelect.dragData.endCell.row = row;
                        _scope.ugCustomSelect.dragData.endCell.col = col;
                    }

                    function clearDragData() {
                        clearEndCell();
                        clearStartCell();
                        clearSelectedStates();
                    }

                    function clearStartCell() {
                        _scope.ugCustomSelect.dragData.startCell.row = null;
                        _scope.ugCustomSelect.dragData.startCell.col = null;
                    }

                    function clearEndCell() {
                        _scope.ugCustomSelect.dragData.endCell.row = null;
                        _scope.ugCustomSelect.dragData.endCell.col = null;
                    }

                    // Sets selected styling based on start cell and end cell, including cells in between that range
                    function setSelectedStates() {
                        clearSelectedStates();
                        var indexMap = createIndexMap(_scope.ugCustomSelect.dragData.startCell, _scope.ugCustomSelect.dragData.endCell);
                        _scope.ugCustomSelect.selectedCells = getCellsWithIndexMap(indexMap);

                        var focusedCells = [];
                        var lastRowCol = null;
                        for (var i = 0; i < _scope.ugCustomSelect.selectedCells.length; i++) {
                            var currentCell = _scope.ugCustomSelect.selectedCells[i];
                            focusedCells.push(uiGridCtrl.cellNav.makeRowCol(currentCell));
                        }
                        grid.cellNav.focusedCells = focusedCells;
                        _scope.$broadcast(uiGridCellNavConstants.CELL_NAV_EVENT);
                        if (focusedCells.length > 0) {
                            var lastFocusedCell = focusedCells[focusedCells.length - 1];
                            grid.api.cellNav.raise.navigate(lastFocusedCell, grid.cellNav.lastRowCol);
                            grid.cellNav.lastRowCol = lastFocusedCell;
                        }
                    }

                    // Clears selected state from any selected cells
                    function clearSelectedStates() {
                        _scope.ugCustomSelect.selectedCells = [];
                    }

                    function createIndexMap(startCell, endCell) {
                        var rowStart = grid.renderContainers.body.renderedRows.indexOf(_scope.ugCustomSelect.dragData.startCell.row),
                            rowEnd = grid.renderContainers.body.renderedRows.indexOf(_scope.ugCustomSelect.dragData.endCell.row),
                            colStart = grid.renderContainers.body.renderedColumns.indexOf(_scope.ugCustomSelect.dragData.startCell.col),
                            colEnd = grid.renderContainers.body.renderedColumns.indexOf(_scope.ugCustomSelect.dragData.endCell.col)

                        if (rowEnd === -1)
                            rowEnd = rowStart;

                        if (colEnd === -1)
                            colEnd = colStart;

                        return {
                            row: {
                                start: (rowStart < rowEnd) ? rowStart : rowEnd,
                                end: (rowEnd > rowStart) ? rowEnd : rowStart
                            },
                            col: {
                                start: (colStart < colEnd) ? colStart : colEnd,
                                end: (colEnd > colStart) ? colEnd : colStart
                            }
                        };
                    }

                    function getCellsWithIndexMap(indexMap) {
                        var visibleCols = grid.renderContainers.body.renderedColumns;
                        var visibleRows = grid.renderContainers.body.renderedRows;
                        var cellsArray = [];

                        for (var ri = indexMap.row.start; ri <= indexMap.row.end; ri++) {
                            var currentRow = visibleRows[ri];
                            for (var ci = indexMap.col.start; ci <= indexMap.col.end; ci++) {
                                var currentCol = visibleCols[ci];
                                var cellElem = getCellElem(currentCol, ri);

                                if (cellElem) {
                                    cellsArray.push({
                                        row: currentRow,
                                        col: currentCol,
                                        elem: cellElem
                                    });
                                }
                            }
                        }

                        return cellsArray;
                    }

                    function getCellElem(col, rowIndex) {
                        return (col && col.uid && typeof rowIndex == 'number') ? angular.element('#' + grid.id + '-' + rowIndex + '-' + col.uid + '-cell') : null;
                    }

                    function createCopyData() {
                        var cells = grid.cellNav.focusedCells;
                        var copyData = '';
                        for (var i = 0; i < cells.length; i++) {
                            var currentCell = cells[i];
                            var cellValue = grid.getCellValue(currentCell.row, currentCell.col);

                            copyData += cellValue? cellValue : '';

                            var proxRowUid = (i < cells.length - 1) ? cells[i + 1].row.uid : '';
                            if (!proxRowUid || proxRowUid != currentCell.row.uid) {
                                copyData += '\n';
                            } else if (i !== cells.length - 1) {
                                copyData += '\t';
                            }
                        }

                        return copyData;
                    }
                }
            };
        }
    };
}]);
