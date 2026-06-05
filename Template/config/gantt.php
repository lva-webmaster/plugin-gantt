<div class="page-header">
    <h2><?= t('Gantt settings') ?></h2>
</div>

<?php if (!empty($warnings)): ?>
    <?php foreach ($warnings as $warning): ?>
        <p class="alert alert-error"><i class="fa fa-exclamation-triangle"></i> <?= $this->text->e($warning) ?></p>
    <?php endforeach ?>
<?php endif ?>

<form method="post" action="<?= $this->url->href('ConfigController', 'save', array('plugin' => 'Gantt')) ?>" autocomplete="off">

    <?= $this->form->csrf() ?>

    <fieldset>
        <legend><?= t('Gantt chart') ?></legend>
        <?= $this->form->radios('gantt_task_sort', array(
                'board' => t('Sort tasks by position'),
                'date' => t('Sort tasks by date'),
            ),
            $values
        ) ?>
    </fieldset>

    <fieldset>
        <legend><?= t('Dependencies') ?></legend>
        <?= $this->form->label(t('Link type that represents "blocks" dependency'), 'gantt_dependency_link_id') ?>
        <?= $this->form->select('gantt_dependency_link_id', $link_labels, $values) ?>
        <p class="form-help"><?= t('Tasks connected by this link type will show dependency arrows. The blocked task cannot start before the blocking task ends.') ?></p>
    </fieldset>

    <fieldset>
        <legend><?= t('Milestones') ?></legend>
        <?= $this->form->label(t('Link type that marks a task as a milestone'), 'gantt_milestone_link_id') ?>
        <?= $this->form->select('gantt_milestone_link_id', $link_labels, $values) ?>
        <p class="form-help"><?= t('Tasks with this outgoing link type will be rendered as diamond-shaped milestones on the Gantt chart. Default: "is a milestone of" (ID 9).') ?></p>
    </fieldset>

    <div class="form-actions">
        <button type="submit" class="btn btn-blue"><?= t('Save') ?></button>
    </div>
</form>
