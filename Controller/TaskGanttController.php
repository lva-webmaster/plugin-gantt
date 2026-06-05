<?php

namespace Kanboard\Plugin\Gantt\Controller;

use Kanboard\Controller\BaseController;
use Kanboard\Filter\TaskProjectFilter;
use Kanboard\Model\TaskModel;

/**
 * Tasks Gantt Controller
 *
 * @package  Kanboard\Controller
 * @author   Frederic Guillot
 * @property \Kanboard\Plugin\Gantt\Formatter\TaskGanttFormatter $taskGanttFormatter
 */
class TaskGanttController extends BaseController
{
    /**
     * Show Gantt chart for one project
     */
    public function show()
    {
        $project = $this->getProject();
        $search = $this->helper->projectHeader->getSearchQuery($project);
        $sorting = $this->request->getStringParam('sorting', '');
        $direction = $this->request->getStringParam('direction', '');
        $filter = $this->taskLexer->build($search)->withFilter(new TaskProjectFilter($project['id']));

        if ($sorting === '') {
            $sorting = $this->configModel->get('gantt_task_sort', 'board');
        }
        if ($direction === '') {
            $direction = 'asc';
        }

        $dir = $direction === 'desc' ? 'desc' : 'asc';
        $query = $filter->getQuery();

        switch ($sorting) {
            case 'date':
                $query->$dir(TaskModel::TABLE.'.date_started')->asc(TaskModel::TABLE.'.date_creation');
                break;
            case 'due':
                $query->$dir(TaskModel::TABLE.'.date_due')->asc(TaskModel::TABLE.'.date_started');
                break;
            case 'priority':
                $query->$dir(TaskModel::TABLE.'.priority')->asc(TaskModel::TABLE.'.position');
                break;
            case 'assignee':
                $query->$dir('assignee_name')->$dir('assignee_username')->asc(TaskModel::TABLE.'.position');
                break;
            case 'title':
                $query->$dir(TaskModel::TABLE.'.title');
                break;
            default:
                $query->$dir('column_position')->$dir(TaskModel::TABLE.'.position');
                $sorting = 'board';
                break;
        }

        $hasSubtaskdate = class_exists('\Kanboard\Plugin\Subtaskdate\Plugin');

        $this->response->html($this->helper->layout->app('Gantt:task_gantt/show', array(
            'project' => $project,
            'title' => $project['name'],
            'description' => $this->helper->projectHeader->getDescription($project),
            'sorting' => $sorting,
            'direction' => $dir,
            'tasks' => $filter->format($this->taskGanttFormatter),
            'has_subtaskdate' => $hasSubtaskdate,
        )));
    }

    /**
     * Save new task start date and due date
     */
    public function save()
    {
        $this->getProject();
        $changes = $this->request->getJson();
        $values = [];

        if (! empty($changes['start'])) {
            $values['date_started'] = strtotime($changes['start']);
        }

        if (! empty($changes['end'])) {
            $values['date_due'] = strtotime($changes['end']);
        }

        if (! empty($values)) {
            $values['id'] = $changes['id'];
            $result = $this->taskModificationModel->update($values);

            if (! $result) {
                $this->response->json(array('message' => 'Unable to save task'), 400);
            } else {
                $this->response->json(array('message' => 'OK'), 201);
            }
        } else {
            $this->response->json(array('message' => 'Ignored'), 200);
        }
    }

    /**
     * Get internal links, link types, and project tasks for the link modal
     */
    public function taskLinks()
    {
        $project = $this->getProject();
        $taskId = $this->request->getIntegerParam('task_id');

        $links = $this->taskLinkModel->getAll($taskId);
        $labels = $this->linkModel->getList(0, false);

        $tasks = $this->db
            ->table(TaskModel::TABLE)
            ->columns('id', 'title')
            ->eq('project_id', $project['id'])
            ->eq('is_active', 1)
            ->neq('id', $taskId)
            ->asc('title')
            ->findAll();

        $this->response->json(array(
            'links' => $links,
            'labels' => $labels,
            'tasks' => $tasks,
        ));
    }

    /**
     * Create a new internal link via AJAX
     */
    public function saveLink()
    {
        $this->getProject();
        $data = $this->request->getJson();

        $taskId = (int) $data['task_id'];
        $oppositeTaskId = (int) $data['opposite_task_id'];
        $linkId = (int) $data['link_id'];

        $result = $this->taskLinkModel->create($taskId, $oppositeTaskId, $linkId);

        if ($result !== false) {
            $this->response->json(array('message' => 'OK'), 201);
        } else {
            $this->response->json(array('message' => 'Unable to create link. It may already exist.'), 400);
        }
    }

    /**
     * Remove an internal link via AJAX
     */
    public function removeLink()
    {
        $this->getProject();
        $data = $this->request->getJson();

        $linkId = (int) $data['link_id'];
        $result = $this->taskLinkModel->remove($linkId);

        if ($result) {
            $this->response->json(array('message' => 'OK'));
        } else {
            $this->response->json(array('message' => 'Unable to remove link.'), 400);
        }
    }

    /**
     * Save subtask due date
     */
    public function saveSubtask()
    {
        $this->getProject();
        $changes = $this->request->getJson();

        if (! empty($changes['id']) && ! empty($changes['due_date'])) {
            $result = $this->subtaskModel->update(array(
                'id' => (int) $changes['id'],
                'due_date' => strtotime($changes['due_date']),
            ));

            if ($result) {
                $this->response->json(array('message' => 'OK'), 201);
            } else {
                $this->response->json(array('message' => 'Unable to save subtask'), 400);
            }
        } else {
            $this->response->json(array('message' => 'Ignored'), 200);
        }
    }
}
