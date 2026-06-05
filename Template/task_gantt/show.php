<section id="main">
    <?= $this->projectHeader->render($project, 'TaskGanttController', 'show', false, 'Gantt') ?>
    <div class="menu-inline">
        <ul>
            <li>
                <a href="#" id="gantt-help-btn" title="<?= t('Gantt chart help') ?>"><i class="fa fa-question-circle"></i></a>
            </li>
            <?php
                $sorts = array(
                    'board'    => array('icon' => 'th-list',       'label' => t('Board position')),
                    'date'     => array('icon' => 'calendar',      'label' => t('Start date')),
                    'due'      => array('icon' => 'clock-o',       'label' => t('Due date')),
                    'priority' => array('icon' => 'flag',          'label' => t('Priority')),
                    'assignee' => array('icon' => 'user',          'label' => t('Assignee')),
                    'title'    => array('icon' => 'font',          'label' => t('Title')),
                );
                foreach ($sorts as $key => $sort):
                    $isActive = ($sorting === $key);
                    $nextDir = ($isActive && $direction === 'asc') ? 'desc' : 'asc';
                    $arrow = $isActive ? ($direction === 'asc' ? ' <i class="fa fa-caret-up"></i>' : ' <i class="fa fa-caret-down"></i>') : '';
            ?>
            <li <?= $isActive ? 'class="active"' : '' ?>>
                <a href="<?= $this->url->href('TaskGanttController', 'show', array('project_id' => $project['id'], 'sorting' => $key, 'direction' => $nextDir, 'plugin' => 'Gantt')) ?>">
                    <i class="fa fa-<?= $sort['icon'] ?>"></i> <?= $sort['label'] ?><?= $arrow ?>
                </a>
            </li>
            <?php endforeach ?>
            <li>
                <?= $this->modal->large('plus', t('Add task'), 'TaskCreationController', 'show', array('project_id' => $project['id'])) ?>
            </li>
            <li class="gantt-toolbar-separator"></li>
            <li>
                <select id="gantt-group-select" title="<?= t('Group by') ?>">
                    <option value="none"><?= t('No grouping') ?></option>
                    <option value="swimlane"><?= t('Swimlane') ?></option>
                    <option value="assignee"><?= t('Assignee') ?></option>
                    <option value="category"><?= t('Category') ?></option>
                    <option value="column"><?= t('Column') ?></option>
                    <option value="priority"><?= t('Priority') ?></option>
                </select>
            </li>
            <li class="gantt-toolbar-separator"></li>
            <li class="gantt-zoom-buttons">
                <button class="gantt-zoom-btn" data-zoom="month" title="<?= t('Month') ?>"><i class="fa fa-compress"></i></button>
                <button class="gantt-zoom-btn" data-zoom="week" title="<?= t('Week') ?>"><i class="fa fa-minus"></i></button>
                <button class="gantt-zoom-btn active" data-zoom="day" title="<?= t('Day') ?>"><i class="fa fa-plus"></i></button>
            </li>
        </ul>
    </div>

    <?php if (empty($has_subtaskdate)): ?>
        <p class="alert"><i class="fa fa-info-circle"></i> Install the <a href="https://github.com/eSkiSo/Subtaskdate" target="_blank"><strong>Subtaskdate plugin</strong></a> to enable subtask due dates on the Gantt chart.</p>
    <?php endif ?>

    <?php if (! empty($tasks)): ?>
        <div
            id="gantt-chart"
            data-records='<?= json_encode($tasks, JSON_HEX_APOS) ?>'
            data-save-url="<?= $this->url->href('TaskGanttController', 'save', array('project_id' => $project['id'], 'plugin' => 'Gantt')) ?>"
            data-save-subtask-url="<?= $this->url->href('TaskGanttController', 'saveSubtask', array('project_id' => $project['id'], 'plugin' => 'Gantt')) ?>"
            data-links-url="<?= $this->url->href('TaskGanttController', 'taskLinks', array('project_id' => $project['id'], 'plugin' => 'Gantt')) ?>"
            data-save-link-url="<?= $this->url->href('TaskGanttController', 'saveLink', array('project_id' => $project['id'], 'plugin' => 'Gantt')) ?>"
            data-remove-link-url="<?= $this->url->href('TaskGanttController', 'removeLink', array('project_id' => $project['id'], 'plugin' => 'Gantt')) ?>"
            data-has-subtaskdate="<?= empty($has_subtaskdate) ? '0' : '1' ?>"
            data-label-start-date="<?= t('Start date:') ?>"
            data-label-end-date="<?= t('Due date:') ?>"
            data-label-assignee="<?= t('Assignee:') ?>"
            data-label-category="<?= t('Category:') ?>"
            data-label-priority="<?= t('Priority:') ?>"
            data-label-not-defined="<?= t('There is no start date or due date for this task.') ?>"
            data-label-critical-path="<?= t('Critical path') ?>"
            data-label-float="<?= t('Float:') ?>"
            data-label-milestone="<?= t('Milestone') ?>"
        ></div>
        <p class="alert alert-info"><?= t('Moving or resizing a task will change the start and due date of the task.') ?></p>
    <?php else: ?>
        <p class="alert"><?= t('There is no task in your project.') ?></p>
    <?php endif ?>

    <!-- Gantt Help Modal -->
    <div id="gantt-help-overlay" class="gantt-help-overlay" style="display:none">
        <div class="gantt-help-modal">
            <div class="gantt-help-header">
                <h2><i class="fa fa-bar-chart"></i> Gantt Chart Guide</h2>
                <button class="gantt-help-close" title="Close">&times;</button>
            </div>
            <div class="gantt-help-body">

                <div class="gantt-help-section">
                    <h3><i class="fa fa-arrows"></i> Navigation</h3>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key">Scroll horizontally</td>
                            <td>Scroll the chart area left/right to move through time. The chart extends infinitely in both directions &mdash; new columns are added automatically as you scroll.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Today marker</td>
                            <td>A <span style="color:#e74c3c;font-weight:700">red vertical line</span> with an arrow at the top marks today&rsquo;s date. It is always visible across all zoom levels.</td>
                        </tr>
                    </table>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-search-plus"></i> Zoom Levels</h3>
                    <p>Three zoom buttons in the toolbar control the time scale:</p>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-plus"></i> Day</td>
                            <td>Each column = one day. Day numbers are shown in the header. Full task titles and edit buttons are visible on task bars. Best for detailed short-range planning.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-minus"></i> Week</td>
                            <td>Each column = one day but narrower. Day numbers are hidden. <span style="color:#8b6fff;font-weight:600">Purple vertical lines</span> mark the start of each week (Sunday). Task text is hidden. Best for medium-range overview.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-compress"></i> Month</td>
                            <td>Each column = one day at minimal width. <span style="color:#8b6fff;font-weight:600">Purple vertical lines</span> mark the 1st of each month. Task text is hidden. Best for long-range project overview.</td>
                        </tr>
                    </table>
                    <p>Your selected zoom level is saved automatically and restored on your next visit.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-sort"></i> Sorting</h3>
                    <p>The toolbar links at the top sort all tasks in the chart:</p>
                    <table class="gantt-help-table">
                        <tr><td class="gantt-help-key"><i class="fa fa-th-list"></i> Board position</td><td>Order tasks by their position on the Kanban board (default).</td></tr>
                        <tr><td class="gantt-help-key"><i class="fa fa-calendar"></i> Start date</td><td>Order by task start date.</td></tr>
                        <tr><td class="gantt-help-key"><i class="fa fa-clock-o"></i> Due date</td><td>Order by task due date.</td></tr>
                        <tr><td class="gantt-help-key"><i class="fa fa-flag"></i> Priority</td><td>Order by priority level.</td></tr>
                        <tr><td class="gantt-help-key"><i class="fa fa-user"></i> Assignee</td><td>Order alphabetically by assigned user.</td></tr>
                        <tr><td class="gantt-help-key"><i class="fa fa-font"></i> Title</td><td>Order alphabetically by task title.</td></tr>
                    </table>
                    <p>Click the same sort option again to toggle between ascending <i class="fa fa-caret-up"></i> and descending <i class="fa fa-caret-down"></i> order.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-object-group"></i> Grouping</h3>
                    <p>Use the <strong>grouping dropdown</strong> in the toolbar to organize tasks into collapsible groups:</p>
                    <table class="gantt-help-table">
                        <tr><td class="gantt-help-key">No grouping</td><td>Tasks are shown in a flat list (default).</td></tr>
                        <tr><td class="gantt-help-key">Swimlane</td><td>Group tasks by their swimlane.</td></tr>
                        <tr><td class="gantt-help-key">Assignee</td><td>Group tasks by assigned user.</td></tr>
                        <tr><td class="gantt-help-key">Category</td><td>Group tasks by category.</td></tr>
                        <tr><td class="gantt-help-key">Column</td><td>Group tasks by board column.</td></tr>
                        <tr><td class="gantt-help-key">Priority</td><td>Group tasks by priority level.</td></tr>
                    </table>
                    <p><strong>Collapsing groups:</strong> Click any group header row to collapse or expand it. The <i class="fa fa-caret-down"></i> / <i class="fa fa-caret-right"></i> icon shows the current state. Collapsed groups are remembered across page refreshes, and each grouping mode maintains its own set of collapsed groups independently.</p>
                    <p>Your selected grouping is saved automatically.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-minus-square-o"></i> Toggle Buttons</h3>
                    <p>Small buttons appear in the <strong>top-left corner</strong> of the chart area:</p>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-minus-square-o"></i> / <i class="fa fa-plus-square-o"></i></td>
                            <td><strong>Collapse / Expand all groups.</strong> Only visible when a grouping is selected. Collapses or expands every group at once. State is saved to local storage.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-minus-square-o"></i> / <i class="fa fa-plus-square-o"></i></td>
                            <td><strong>Collapse / Expand all subtasks.</strong> Only visible when tasks have subtasks. Expands or collapses every task&rsquo;s subtask rows at once. Respects group collapse state &mdash; subtask rows inside collapsed groups stay hidden but are remembered as expanded.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-crosshairs"></i></td>
                            <td><strong>Scroll to today.</strong> Jumps the view so that today&rsquo;s date is roughly one-third from the left edge of the chart. Always visible.</td>
                        </tr>
                    </table>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-arrows-h"></i> Task Bars</h3>
                    <p>Each task is shown as a colored horizontal bar spanning its start date to due date.</p>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key">Bar color</td>
                            <td>Matches the task&rsquo;s color as set in Kanboard. A darker overlay is applied for contrast.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Progress bar</td>
                            <td>A green inner bar shows task completion percentage based on time tracking or subtask progress.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Dashed outline</td>
                            <td>Tasks without a defined start or due date appear as <em>faded, dashed-border</em> placeholders. Set their dates to make them solid.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Diagonal stripes</td>
                            <td>A subtle diagonal stripe overlay indicates <strong>unassigned</strong> tasks and subtasks. Assign someone to remove the stripes.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-pencil"></i> Edit button</td>
                            <td>Hover over a task bar to reveal the edit icon on the right side. Click it to open the task edit dialog. You can also click the <i class="fa fa-pencil"></i> icon next to the task name in the left sidebar.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-info-circle"></i> Tooltip</td>
                            <td>Hover over the task name (with the <i class="fa fa-info-circle"></i> icon) in the left sidebar to see a tooltip showing start date, due date, assignee, category, and priority.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><span style="color:#e74c3c"><i class="fa fa-exclamation-circle"></i></span> Overdue</td>
                            <td>Tasks past their due date show a red exclamation icon next to their name in the left sidebar.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><i class="fa fa-link"></i> Links</td>
                            <td>Click the <i class="fa fa-link"></i> icon next to a task name to open the <strong>internal links modal</strong>. View existing links grouped by type, add new links using dropdowns (link type + task), or remove links. The chart reloads when you close the modal after making changes.</td>
                        </tr>
                    </table>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-hand-pointer-o"></i> Drag &amp; Resize</h3>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key">Move a task</td>
                            <td><strong>Drag</strong> a task bar left or right to change its start and due dates. Both dates shift together, preserving the task&rsquo;s duration. A floating indicator shows the new dates as you drag.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Resize a task</td>
                            <td><strong>Drag the right edge</strong> of a task bar to change its due date (making it longer or shorter). The start date stays fixed.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Auto-scroll</td>
                            <td>When dragging a task near the left or right edge of the chart, the view automatically scrolls to reveal more dates.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Constraint snapping</td>
                            <td>If a task has dependencies, you cannot drag or resize it past its dependency constraints. If you try, a warning toast appears at the bottom of the screen.</td>
                        </tr>
                    </table>
                    <p>Changes are saved to the server immediately. A <span style="color:#2ecc71;font-weight:600">&ldquo;Saved&rdquo;</span> toast notification confirms success.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-link"></i> Dependencies</h3>
                    <p>If tasks have dependencies defined, they are shown as <strong>curved arrows</strong> connecting task bars. The arrow points from the dependency (predecessor) to the dependent task.</p>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key">Normal arrows</td>
                            <td>Gray curved lines with arrowheads between related tasks.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><span style="color:#ff4444;font-weight:700">Critical arrows</span></td>
                            <td>Red, thicker arrows show dependency links that are part of the critical path.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key"><span style="color:#e67e22">Violation highlight</span></td>
                            <td>If a task starts before its dependency ends (a scheduling violation), the task bar gets an orange inset border to flag the conflict.</td>
                        </tr>
                    </table>
                    <p>Arrows are redrawn automatically when you move tasks, toggle groups, or change zoom.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-road"></i> Critical Path</h3>
                    <p>The <strong>critical path</strong> is the longest chain of dependent tasks that determines the project&rsquo;s minimum duration. Tasks on the critical path are highlighted with a <span style="color:#ff4444;font-weight:700">red left-edge indicator</span> on their bars. Any delay to a critical-path task delays the entire project.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-diamond"></i> Milestones</h3>
                    <p>Tasks tagged as milestones display a <span style="color:#c084fc"><i class="fa fa-diamond"></i></span> icon next to their name and have a distinctive <strong>rainbow-cycling color animation</strong> on their bars, making them easy to spot. Milestone dependency arrows are shown in <span style="color:#8e44ad;font-weight:600">purple dashed lines</span>.</p>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-tasks"></i> Subtasks</h3>
                    <p>If the <strong>Subtaskdate plugin</strong> is installed, tasks with subtasks show a <i class="fa fa-caret-right"></i> toggle icon next to their name. Click it to expand and reveal subtask rows beneath the parent task.</p>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key">Subtask bars</td>
                            <td>Smaller, thinner bars represent each subtask. Colors indicate status: <span style="color:#546e7a;font-weight:600">gray</span> = not started, <span style="color:#ffa726;font-weight:600">orange</span> = in progress, <span style="color:#66bb6a;font-weight:600">green</span> = done.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Move subtasks</td>
                            <td>Drag a subtask bar to change its due date. Subtasks are constrained to not exceed their parent task&rsquo;s due date.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">Expand state</td>
                            <td>Which tasks have their subtasks expanded is remembered across page refreshes.</td>
                        </tr>
                    </table>
                </div>

                <div class="gantt-help-section">
                    <h3><i class="fa fa-floppy-o"></i> What Gets Saved</h3>
                    <table class="gantt-help-table">
                        <tr>
                            <td class="gantt-help-key">To the server</td>
                            <td>Task start/due dates (when you drag or resize). Subtask due dates (when you drag). These affect all users.</td>
                        </tr>
                        <tr>
                            <td class="gantt-help-key">To your browser</td>
                            <td>Zoom level, grouping selection, expanded subtasks, collapsed groups. These are per-browser and per-page &mdash; they only affect your view.</td>
                        </tr>
                    </table>
                </div>

            </div>
        </div>
    </div>
</section>
