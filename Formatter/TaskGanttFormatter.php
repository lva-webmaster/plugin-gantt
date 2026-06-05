<?php

namespace Kanboard\Plugin\Gantt\Formatter;

use Kanboard\Formatter\BaseFormatter;
use Kanboard\Core\Filter\FormatterInterface;

/**
 * Task Gantt Formatter
 *
 * @package formatter
 * @author  Frederic Guillot
 */
class TaskGanttFormatter extends BaseFormatter implements FormatterInterface
{
    /**
     * Local cache for project columns
     *
     * @access private
     * @var array
     */
    private $columns = array();

    /**
     * Apply formatter
     *
     * @access public
     * @return array
     */
    public function format()
    {
        $bars = array();
        $taskIds = array();

        foreach ($this->query->findAll() as $task) {
            $bars[] = $this->formatTask($task);
            $taskIds[] = $task['id'];
        }

        $dependencyLinkId = (int) $this->configModel->get('gantt_dependency_link_id', 2);
        $dependencies = $this->getDependencies($taskIds, $dependencyLinkId);

        foreach ($bars as &$bar) {
            $bar['dependencies'] = isset($dependencies[$bar['id']]) ? $dependencies[$bar['id']] : array();
        }

        return $bars;
    }

    /**
     * Get dependency links for a set of tasks
     *
     * Returns tasks that each task blocks (forward dependencies).
     * If task A "blocks" task B, then A's dependencies array contains B's id.
     *
     * @access private
     * @param  array  $taskIds
     * @param  int    $blockLinkId  The link ID for "blocks" (default 2)
     * @return array  Keyed by task_id => array of blocked task IDs
     */
    private function getDependencies(array $taskIds, $blockLinkId)
    {
        if (empty($taskIds) || empty($blockLinkId)) {
            return array();
        }

        $rows = $this->db
            ->table('task_has_links')
            ->columns('task_id', 'opposite_task_id')
            ->eq('link_id', $blockLinkId)
            ->in('task_id', $taskIds)
            ->in('opposite_task_id', $taskIds)
            ->findAll();

        $deps = array();
        foreach ($rows as $row) {
            $deps[(int) $row['task_id']][] = (int) $row['opposite_task_id'];
        }

        return $deps;
    }

    /**
     * Format a single task
     *
     * @access private
     * @param  array  $task
     * @return array
     */
    private function formatTask(array $task)
    {
        if (! isset($this->columns[$task['project_id']])) {
            $this->columns[$task['project_id']] = $this->columnModel->getList($task['project_id']);
        }

        $start = $task['date_started'] ?: time();
        $end = $task['date_due'] ?: $start;

        $tz = $this->configModel->get('application_timezone', 'UTC');
        $dateFmt = $this->configModel->get('application_date_format', 'm/d/Y');
        $timeFmt = $this->configModel->get('application_time_format', 'g:i a');
        $dtFmt = $dateFmt . ' ' . $timeFmt . ' T';
        $dtStart = new \DateTime('@'.$start);
        $dtStart->setTimezone(new \DateTimeZone($tz));
        $dtEnd = new \DateTime('@'.$end);
        $dtEnd->setTimezone(new \DateTimeZone($tz));

        return array(
            'type' => 'task',
            'id' => $task['id'],
            'title' => $task['title'],
            'start' => array(
                (int) date('Y', $start),
                (int) date('n', $start),
                (int) date('j', $start),
            ),
            'end' => array(
                (int) date('Y', $end),
                (int) date('n', $end),
                (int) date('j', $end),
            ),
            'start_formatted' => $dtStart->format($dtFmt),
            'end_formatted' => $dtEnd->format($dtFmt),
            'column_title' => $task['column_name'],
            'assignee' => $task['assignee_name'] ?: $task['assignee_username'],
            'category' => isset($task['category_name']) ? $task['category_name'] : '',
            'priority' => isset($task['priority']) ? (int) $task['priority'] : 0,
            'progress' => $this->taskModel->getProgress($task, $this->columns[$task['project_id']]).'%',
            'link' => $this->helper->url->href('TaskViewController', 'show', array('project_id' => $task['project_id'], 'task_id' => $task['id'])),
            'color' => $this->colorModel->getColorProperties($task['color_id']),
            'not_defined' => empty($task['date_due']) || empty($task['date_started']),
            'date_started_not_defined' => empty($task['date_started']),
            'date_due_not_defined' => empty($task['date_due']),
        );
    }
}
