<section id="main">
    <?= $this->projectHeader->render($project, 'TaskGanttController', 'show', false, 'Gantt') ?>
    <div class="menu-inline">
        <ul>
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
            data-has-subtaskdate="<?= empty($has_subtaskdate) ? '0' : '1' ?>"
            data-label-start-date="<?= t('Start date:') ?>"
            data-label-end-date="<?= t('Due date:') ?>"
            data-label-assignee="<?= t('Assignee:') ?>"
            data-label-category="<?= t('Category:') ?>"
            data-label-priority="<?= t('Priority:') ?>"
            data-label-not-defined="<?= t('There is no start date or due date for this task.') ?>"
        ></div>
        <p class="alert alert-info"><?= t('Moving or resizing a task will change the start and due date of the task.') ?></p>
    <?php else: ?>
        <p class="alert"><?= t('There is no task in your project.') ?></p>
    <?php endif ?>
</section>
